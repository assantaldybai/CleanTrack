#!/usr/bin/env python3
"""
SKYX Cleaning SaaS Backend Test Suite
Tests all backend API endpoints with focus on auth, RLS, and workflow
"""
import requests
import json
from datetime import datetime, timedelta

# Test configuration
# Note: Using localhost because external URL routing is not configured
BASE_URL = "http://localhost:8001/api"

# Test credentials from /app/memory/test_credentials.md
CREDENTIALS = {
    "superadmin": {"username": "superadmin", "password": "Super2025!"},
    "org_gazprom": {"username": "org_gazprom", "password": "Org2025!"},
    "cleaning_admin": {"username": "cleaning_admin", "password": "Clean2025!"},
    "cleaner_maria": {"username": "cleaner_maria", "password": "Cleaner2025!"},
}

# Store tokens and IDs for tests
tokens = {}
test_data = {}


def print_test(name):
    """Print test name"""
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)


def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")


def print_error(error):
    """Print error details"""
    print(f"ERROR: {error}")


# ============================================================================
# SCENARIO 1: Backend Health and Auth Login for All Roles
# ============================================================================

def test_backend_health():
    """Test backend health endpoint /api/"""
    print_test("Backend Health Check")
    try:
        response = requests.get(f"{BASE_URL}/", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print_result(True, f"Backend is healthy: {data.get('message')}")
            print(f"Available roles: {data.get('roles')}")
            return True
        else:
            print_result(False, f"Backend returned status {response.status_code}")
            return False
    except Exception as e:
        print_error(str(e))
        return False


def test_login_all_roles():
    """Test login for all four roles"""
    print_test("Login for All Roles")
    all_success = True
    
    for role_key, creds in CREDENTIALS.items():
        try:
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json=creds,
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                tokens[role_key] = data["token"]
                test_data[f"{role_key}_user"] = data["user"]
                print_result(True, f"{role_key} login successful - Role: {data['user']['role']}")
            else:
                print_result(False, f"{role_key} login failed with status {response.status_code}")
                print(f"Response: {response.text}")
                all_success = False
        except Exception as e:
            print_error(f"{role_key} login error: {str(e)}")
            all_success = False
    
    return all_success


def test_auth_me_all_roles():
    """Test /api/auth/me with token for all roles"""
    print_test("Auth /me Endpoint for All Roles")
    all_success = True
    
    for role_key, token in tokens.items():
        try:
            response = requests.get(
                f"{BASE_URL}/auth/me",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                print_result(True, f"{role_key} /me successful - Username: {data['username']}, Role: {data['role']}")
            else:
                print_result(False, f"{role_key} /me failed with status {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"{role_key} /me error: {str(e)}")
            all_success = False
    
    return all_success


def test_auth_without_token():
    """Test that endpoints return 401 without token"""
    print_test("Unauthorized Access (No Token)")
    try:
        response = requests.get(f"{BASE_URL}/auth/me", timeout=10)
        if response.status_code == 401:
            print_result(True, "Correctly returns 401 without token")
            return True
        else:
            print_result(False, f"Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print_error(str(e))
        return False


# ============================================================================
# SCENARIO 2: RLS/Tenant Isolation
# ============================================================================

def test_rls_organization_admin():
    """Test that organization admin sees only own org data"""
    print_test("RLS: Organization Admin Isolation")
    token = tokens.get("org_gazprom")
    if not token:
        print_result(False, "No token for org_gazprom")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    all_success = True
    
    # Test buildings - should only see own org buildings
    try:
        response = requests.get(f"{BASE_URL}/buildings", headers=headers, timeout=10)
        if response.status_code == 200:
            buildings = response.json()
            org_id = test_data["org_gazprom_user"]["organization_id"]
            all_org_scoped = all(b.get("organization_id") == org_id for b in buildings)
            if all_org_scoped:
                print_result(True, f"Buildings correctly scoped to org {org_id} - Count: {len(buildings)}")
            else:
                print_result(False, "Buildings contain data from other organizations")
                all_success = False
        else:
            print_result(False, f"Buildings request failed: {response.status_code}")
            all_success = False
    except Exception as e:
        print_error(f"Buildings test error: {str(e)}")
        all_success = False
    
    # Test zones - should only see own org zones
    try:
        response = requests.get(f"{BASE_URL}/zones", headers=headers, timeout=10)
        if response.status_code == 200:
            zones = response.json()
            org_id = test_data["org_gazprom_user"]["organization_id"]
            all_org_scoped = all(z.get("organization_id") == org_id for z in zones)
            if all_org_scoped:
                print_result(True, f"Zones correctly scoped to org {org_id} - Count: {len(zones)}")
            else:
                print_result(False, "Zones contain data from other organizations")
                all_success = False
        else:
            print_result(False, f"Zones request failed: {response.status_code}")
            all_success = False
    except Exception as e:
        print_error(f"Zones test error: {str(e)}")
        all_success = False
    
    # Test checklists - should only see own org checklists
    try:
        response = requests.get(f"{BASE_URL}/checklists", headers=headers, timeout=10)
        if response.status_code == 200:
            checklists = response.json()
            org_id = test_data["org_gazprom_user"]["organization_id"]
            all_org_scoped = all(c.get("organization_id") == org_id for c in checklists)
            if all_org_scoped:
                print_result(True, f"Checklists correctly scoped to org {org_id} - Count: {len(checklists)}")
            else:
                print_result(False, "Checklists contain data from other organizations")
                all_success = False
        else:
            print_result(False, f"Checklists request failed: {response.status_code}")
            all_success = False
    except Exception as e:
        print_error(f"Checklists test error: {str(e)}")
        all_success = False
    
    return all_success


def test_rls_cleaning_admin():
    """Test that cleaning admin sees only own company tasks"""
    print_test("RLS: Cleaning Company Admin Isolation")
    token = tokens.get("cleaning_admin")
    if not token:
        print_result(False, "No token for cleaning_admin")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    all_success = True
    
    # Test assignments - should only see own company assignments
    try:
        response = requests.get(f"{BASE_URL}/assignments", headers=headers, timeout=10)
        if response.status_code == 200:
            assignments = response.json()
            company_id = test_data["cleaning_admin_user"]["cleaning_company_id"]
            all_company_scoped = all(a.get("cleaning_company_id") == company_id for a in assignments)
            if all_company_scoped:
                print_result(True, f"Assignments correctly scoped to company {company_id} - Count: {len(assignments)}")
            else:
                print_result(False, "Assignments contain data from other companies")
                all_success = False
        else:
            print_result(False, f"Assignments request failed: {response.status_code}")
            all_success = False
    except Exception as e:
        print_error(f"Assignments test error: {str(e)}")
        all_success = False
    
    # Test users - should only see own company users
    try:
        response = requests.get(f"{BASE_URL}/users", headers=headers, timeout=10)
        if response.status_code == 200:
            users = response.json()
            company_id = test_data["cleaning_admin_user"]["cleaning_company_id"]
            all_company_scoped = all(u.get("cleaning_company_id") == company_id for u in users)
            if all_company_scoped:
                print_result(True, f"Users correctly scoped to company {company_id} - Count: {len(users)}")
            else:
                print_result(False, "Users contain data from other companies")
                all_success = False
        else:
            print_result(False, f"Users request failed: {response.status_code}")
            all_success = False
    except Exception as e:
        print_error(f"Users test error: {str(e)}")
        all_success = False
    
    return all_success


def test_rls_cleaner():
    """Test that cleaner sees only own tasks"""
    print_test("RLS: Cleaner Isolation")
    token = tokens.get("cleaner_maria")
    if not token:
        print_result(False, "No token for cleaner_maria")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    all_success = True
    
    # Test assignments - should only see own assignments
    try:
        response = requests.get(f"{BASE_URL}/assignments", headers=headers, timeout=10)
        if response.status_code == 200:
            assignments = response.json()
            cleaner_id = test_data["cleaner_maria_user"]["id"]
            all_cleaner_scoped = all(a.get("cleaner_user_id") == cleaner_id for a in assignments)
            if all_cleaner_scoped:
                print_result(True, f"Assignments correctly scoped to cleaner {cleaner_id} - Count: {len(assignments)}")
                test_data["cleaner_assignments"] = assignments
            else:
                print_result(False, "Assignments contain tasks for other cleaners")
                all_success = False
        else:
            print_result(False, f"Assignments request failed: {response.status_code}")
            all_success = False
    except Exception as e:
        print_error(f"Assignments test error: {str(e)}")
        all_success = False
    
    return all_success


def test_rls_unauthorized_access():
    """Test that unauthorized access returns 403"""
    print_test("RLS: Unauthorized Access Returns 403")
    
    # Try cleaner accessing organizations (should fail)
    token = tokens.get("cleaner_maria")
    if not token:
        print_result(False, "No token for cleaner_maria")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.post(
            f"{BASE_URL}/organizations",
            headers=headers,
            json={"name": "Unauthorized Org"},
            timeout=10
        )
        if response.status_code == 403:
            print_result(True, "Cleaner correctly denied access to create organization (403)")
            return True
        else:
            print_result(False, f"Expected 403, got {response.status_code}")
            return False
    except Exception as e:
        print_error(str(e))
        return False


# ============================================================================
# SCENARIO 3: Super Admin Creates Organization, Company, and Accounts
# ============================================================================

def test_superadmin_create_organization():
    """Test super admin can create organization"""
    print_test("Super Admin: Create Organization")
    token = tokens.get("superadmin")
    if not token:
        print_result(False, "No token for superadmin")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.post(
            f"{BASE_URL}/organizations",
            headers=headers,
            json={
                "name": "Test Organization Alpha",
                "inn": "1234567890",
                "city": "Saint Petersburg",
                "notes": "Created by test suite"
            },
            timeout=10
        )
        if response.status_code == 200:
            org = response.json()
            test_data["test_org"] = org
            print_result(True, f"Organization created - ID: {org['id']}, Name: {org['name']}")
            return True
        else:
            print_result(False, f"Failed to create organization: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(str(e))
        return False


def test_superadmin_create_cleaning_company():
    """Test super admin can create cleaning company linked to organization"""
    print_test("Super Admin: Create Cleaning Company")
    token = tokens.get("superadmin")
    if not token:
        print_result(False, "No token for superadmin")
        return False
    
    if "test_org" not in test_data:
        print_result(False, "No test organization available")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.post(
            f"{BASE_URL}/cleaning-companies",
            headers=headers,
            json={
                "name": "Test Cleaning Company Beta",
                "type": "company",
                "organization_ids": [test_data["test_org"]["id"]],
                "notes": "Created by test suite"
            },
            timeout=10
        )
        if response.status_code == 200:
            company = response.json()
            test_data["test_company"] = company
            print_result(True, f"Cleaning company created - ID: {company['id']}, Name: {company['name']}")
            print(f"Linked to organizations: {company['organization_ids']}")
            return True
        else:
            print_result(False, f"Failed to create cleaning company: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(str(e))
        return False


def test_superadmin_create_accounts():
    """Test super admin can create role accounts without email/phone"""
    print_test("Super Admin: Create Role Accounts (No Email/Phone)")
    token = tokens.get("superadmin")
    if not token:
        print_result(False, "No token for superadmin")
        return False
    
    if "test_org" not in test_data or "test_company" not in test_data:
        print_result(False, "Missing test organization or company")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    all_success = True
    
    # Create organization admin
    try:
        response = requests.post(
            f"{BASE_URL}/users",
            headers=headers,
            json={
                "username": f"test_org_admin_{datetime.now().timestamp()}",
                "password": "TestPass123!",
                "name": "Test Org Admin",
                "role": "organization_admin",
                "organization_id": test_data["test_org"]["id"]
            },
            timeout=10
        )
        if response.status_code == 200:
            user = response.json()
            test_data["test_org_admin"] = user
            print_result(True, f"Organization admin created - Username: {user['username']}")
        else:
            print_result(False, f"Failed to create org admin: {response.status_code}")
            print(f"Response: {response.text}")
            all_success = False
    except Exception as e:
        print_error(f"Org admin creation error: {str(e)}")
        all_success = False
    
    # Create cleaning company admin
    try:
        response = requests.post(
            f"{BASE_URL}/users",
            headers=headers,
            json={
                "username": f"test_clean_admin_{datetime.now().timestamp()}",
                "password": "TestPass123!",
                "name": "Test Cleaning Admin",
                "role": "cleaning_company_admin",
                "cleaning_company_id": test_data["test_company"]["id"]
            },
            timeout=10
        )
        if response.status_code == 200:
            user = response.json()
            test_data["test_clean_admin"] = user
            print_result(True, f"Cleaning admin created - Username: {user['username']}")
        else:
            print_result(False, f"Failed to create cleaning admin: {response.status_code}")
            print(f"Response: {response.text}")
            all_success = False
    except Exception as e:
        print_error(f"Cleaning admin creation error: {str(e)}")
        all_success = False
    
    # Create cleaner
    try:
        response = requests.post(
            f"{BASE_URL}/users",
            headers=headers,
            json={
                "username": f"test_cleaner_{datetime.now().timestamp()}",
                "password": "TestPass123!",
                "name": "Test Cleaner",
                "role": "cleaner",
                "cleaning_company_id": test_data["test_company"]["id"]
            },
            timeout=10
        )
        if response.status_code == 200:
            user = response.json()
            test_data["test_cleaner"] = user
            print_result(True, f"Cleaner created - Username: {user['username']}")
        else:
            print_result(False, f"Failed to create cleaner: {response.status_code}")
            print(f"Response: {response.text}")
            all_success = False
    except Exception as e:
        print_error(f"Cleaner creation error: {str(e)}")
        all_success = False
    
    return all_success


# ============================================================================
# SCENARIO 4: Organization Admin Creates Building, Zone, Checklist, Assignment
# ============================================================================

def test_org_admin_create_building():
    """Test organization admin can create building"""
    print_test("Organization Admin: Create Building")
    token = tokens.get("org_gazprom")
    if not token:
        print_result(False, "No token for org_gazprom")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.post(
            f"{BASE_URL}/buildings",
            headers=headers,
            json={
                "name": "Test Building Gamma",
                "address": "Test Street 123, Moscow",
                "type": "office",
                "floors": 5,
                "total_area": 2500.0
            },
            timeout=10
        )
        if response.status_code == 200:
            building = response.json()
            test_data["test_building"] = building
            print_result(True, f"Building created - ID: {building['id']}, Name: {building['name']}")
            return True
        else:
            print_result(False, f"Failed to create building: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(str(e))
        return False


def test_org_admin_create_zone():
    """Test organization admin can create zone"""
    print_test("Organization Admin: Create Zone")
    token = tokens.get("org_gazprom")
    if not token:
        print_result(False, "No token for org_gazprom")
        return False
    
    if "test_building" not in test_data:
        print_result(False, "No test building available")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.post(
            f"{BASE_URL}/zones",
            headers=headers,
            json={
                "building_id": test_data["test_building"]["id"],
                "name": "Test Zone Floor 3",
                "floor": 3,
                "type": "office",
                "area": 150.0,
                "description": "Third floor office space"
            },
            timeout=10
        )
        if response.status_code == 200:
            zone = response.json()
            test_data["test_zone"] = zone
            print_result(True, f"Zone created - ID: {zone['id']}, Name: {zone['name']}")
            return True
        else:
            print_result(False, f"Failed to create zone: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(str(e))
        return False


def test_org_admin_create_checklist():
    """Test organization admin can create checklist"""
    print_test("Organization Admin: Create Checklist")
    token = tokens.get("org_gazprom")
    if not token:
        print_result(False, "No token for org_gazprom")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.post(
            f"{BASE_URL}/checklists",
            headers=headers,
            json={
                "name": "Test Office Cleaning Checklist",
                "zone_type": "office",
                "items": [
                    {"task": "Vacuum carpets", "required": True},
                    {"task": "Empty trash bins", "required": True},
                    {"task": "Clean windows", "required": False},
                    {"task": "Sanitize desks", "required": True}
                ]
            },
            timeout=10
        )
        if response.status_code == 200:
            checklist = response.json()
            test_data["test_checklist"] = checklist
            print_result(True, f"Checklist created - ID: {checklist['id']}, Name: {checklist['name']}")
            print(f"Items count: {len(checklist['items'])}")
            return True
        else:
            print_result(False, f"Failed to create checklist: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(str(e))
        return False


def test_org_admin_create_assignment():
    """Test organization admin can create assignment to cleaning company"""
    print_test("Organization Admin: Create Assignment")
    token = tokens.get("org_gazprom")
    if not token:
        print_result(False, "No token for org_gazprom")
        return False
    
    required_data = ["test_zone", "test_checklist"]
    for key in required_data:
        if key not in test_data:
            print_result(False, f"Missing {key}")
            return False
    
    # Get cleaning company linked to this org
    cleaning_company_id = test_data["cleaning_admin_user"]["cleaning_company_id"]
    
    headers = {"Authorization": f"Bearer {token}"}
    tomorrow = (datetime.now() + timedelta(days=1)).date().isoformat()
    
    try:
        response = requests.post(
            f"{BASE_URL}/assignments",
            headers=headers,
            json={
                "zone_id": test_data["test_zone"]["id"],
                "checklist_id": test_data["test_checklist"]["id"],
                "cleaning_company_id": cleaning_company_id,
                "title": "Test Daily Cleaning Assignment",
                "description": "Test assignment created by test suite",
                "scheduled_date": tomorrow,
                "scheduled_time": "10:00",
                "priority": "normal"
            },
            timeout=10
        )
        if response.status_code == 200:
            assignment = response.json()
            test_data["test_assignment"] = assignment
            print_result(True, f"Assignment created - ID: {assignment['id']}, Status: {assignment['status']}")
            print(f"Zone: {assignment.get('zone_name')}, Company: {assignment.get('cleaning_company_name')}")
            return True
        else:
            print_result(False, f"Failed to create assignment: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(str(e))
        return False


# ============================================================================
# SCENARIO 5: Cleaning Admin Creates Cleaner and Assigns Task
# ============================================================================

def test_cleaning_admin_create_cleaner():
    """Test cleaning admin can create cleaner"""
    print_test("Cleaning Admin: Create Cleaner")
    token = tokens.get("cleaning_admin")
    if not token:
        print_result(False, "No token for cleaning_admin")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.post(
            f"{BASE_URL}/users",
            headers=headers,
            json={
                "username": f"test_new_cleaner_{datetime.now().timestamp()}",
                "password": "TestPass123!",
                "name": "Test New Cleaner Delta",
                "role": "cleaner"
            },
            timeout=10
        )
        if response.status_code == 200:
            cleaner = response.json()
            test_data["test_new_cleaner"] = cleaner
            print_result(True, f"Cleaner created - Username: {cleaner['username']}, ID: {cleaner['id']}")
            return True
        else:
            print_result(False, f"Failed to create cleaner: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(str(e))
        return False


def test_cleaning_admin_assign_task():
    """Test cleaning admin can assign task to cleaner"""
    print_test("Cleaning Admin: Assign Task to Cleaner")
    token = tokens.get("cleaning_admin")
    if not token:
        print_result(False, "No token for cleaning_admin")
        return False
    
    if "test_assignment" not in test_data or "test_new_cleaner" not in test_data:
        print_result(False, "Missing test assignment or cleaner")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    assignment_id = test_data["test_assignment"]["id"]
    cleaner_id = test_data["test_new_cleaner"]["id"]
    
    try:
        response = requests.patch(
            f"{BASE_URL}/assignments/{assignment_id}/assign-cleaner",
            headers=headers,
            json={"cleaner_user_id": cleaner_id},
            timeout=10
        )
        if response.status_code == 200:
            assignment = response.json()
            test_data["test_assignment"] = assignment
            print_result(True, f"Task assigned - Cleaner: {assignment.get('cleaner_name')}, Status: {assignment['status']}")
            return True
        else:
            print_result(False, f"Failed to assign task: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(str(e))
        return False


# ============================================================================
# SCENARIO 6: Cleaner Starts Task and Submits Report
# ============================================================================

def test_cleaner_start_task():
    """Test cleaner can start assigned task"""
    print_test("Cleaner: Start Task")
    token = tokens.get("cleaner_maria")
    if not token:
        print_result(False, "No token for cleaner_maria")
        return False
    
    # Get cleaner's assignments
    if "cleaner_assignments" not in test_data or not test_data["cleaner_assignments"]:
        print_result(False, "No assignments available for cleaner")
        return False
    
    # Find an assigned task
    assignment = None
    for a in test_data["cleaner_assignments"]:
        if a.get("status") == "assigned":
            assignment = a
            break
    
    if not assignment:
        print_result(False, "No assigned tasks found for cleaner")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    assignment_id = assignment["id"]
    
    try:
        response = requests.patch(
            f"{BASE_URL}/assignments/{assignment_id}/status",
            headers=headers,
            json={"status": "in_progress"},
            timeout=10
        )
        if response.status_code == 200:
            updated = response.json()
            test_data["cleaner_active_assignment"] = updated
            print_result(True, f"Task started - ID: {assignment_id}, Status: {updated['status']}")
            return True
        else:
            print_result(False, f"Failed to start task: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(str(e))
        return False


def test_cleaner_submit_report():
    """Test cleaner can submit report and task becomes completed"""
    print_test("Cleaner: Submit Report")
    token = tokens.get("cleaner_maria")
    if not token:
        print_result(False, "No token for cleaner_maria")
        return False
    
    if "cleaner_active_assignment" not in test_data:
        print_result(False, "No active assignment for cleaner")
        return False
    
    assignment = test_data["cleaner_active_assignment"]
    headers = {"Authorization": f"Bearer {token}"}
    assignment_id = assignment["id"]
    
    # Build report items from checklist
    checklist_items = assignment.get("checklist_items", [])
    report_items = [
        {
            "item_id": item["id"],
            "task": item["task"],
            "completed": True,
            "comment": "Completed successfully"
        }
        for item in checklist_items
    ]
    
    try:
        response = requests.post(
            f"{BASE_URL}/assignments/{assignment_id}/report",
            headers=headers,
            json={
                "completed_items": report_items,
                "final_notes": "All tasks completed. Area is clean.",
                "quality_score": 5,
                "photo_urls": []
            },
            timeout=10
        )
        if response.status_code == 200:
            updated = response.json()
            test_data["completed_assignment"] = updated
            print_result(True, f"Report submitted - Status: {updated['status']}, Quality: {updated.get('report', {}).get('quality_score')}")
            
            # Verify status is completed
            if updated["status"] == "completed":
                print_result(True, "Assignment status correctly changed to 'completed'")
                return True
            else:
                print_result(False, f"Expected status 'completed', got '{updated['status']}'")
                return False
        else:
            print_result(False, f"Failed to submit report: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(str(e))
        return False


# ============================================================================
# SCENARIO 7: Analytics Endpoint for Each Role
# ============================================================================

def test_analytics_all_roles():
    """Test analytics endpoint returns expected KPI fields for each role"""
    print_test("Analytics: All Roles")
    all_success = True
    
    expected_fields = [
        "assignments_total", "completed", "pending", "assigned", "in_progress",
        "completion_rate", "overdue", "reports_total", "average_quality", "active_cleaners"
    ]
    
    for role_key, token in tokens.items():
        try:
            response = requests.get(
                f"{BASE_URL}/analytics/overview",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                
                # Check expected fields
                missing_fields = [f for f in expected_fields if f not in data]
                if not missing_fields:
                    print_result(True, f"{role_key} analytics - Total: {data['assignments_total']}, Completed: {data['completed']}, Rate: {data['completion_rate']}%")
                    
                    # Super admin should have additional fields
                    if role_key == "superadmin":
                        if "organizations" in data and "cleaning_companies" in data:
                            print_result(True, f"Super admin has extra fields - Orgs: {data['organizations']}, Companies: {data['cleaning_companies']}")
                        else:
                            print_result(False, "Super admin missing organizations/cleaning_companies fields")
                            all_success = False
                else:
                    print_result(False, f"{role_key} analytics missing fields: {missing_fields}")
                    all_success = False
            else:
                print_result(False, f"{role_key} analytics failed: {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"{role_key} analytics error: {str(e)}")
            all_success = False
    
    return all_success


# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def run_all_tests():
    """Run all test scenarios"""
    print("\n" + "="*80)
    print("SKYX CLEANING SAAS BACKEND TEST SUITE")
    print("="*80)
    
    results = {}
    
    # Scenario 1: Backend Health and Auth
    print("\n" + "="*80)
    print("SCENARIO 1: Backend Health and Authentication")
    print("="*80)
    results["backend_health"] = test_backend_health()
    results["login_all_roles"] = test_login_all_roles()
    results["auth_me_all_roles"] = test_auth_me_all_roles()
    results["auth_without_token"] = test_auth_without_token()
    
    # Scenario 2: RLS/Tenant Isolation
    print("\n" + "="*80)
    print("SCENARIO 2: RLS/Tenant Isolation")
    print("="*80)
    results["rls_org_admin"] = test_rls_organization_admin()
    results["rls_cleaning_admin"] = test_rls_cleaning_admin()
    results["rls_cleaner"] = test_rls_cleaner()
    results["rls_unauthorized"] = test_rls_unauthorized_access()
    
    # Scenario 3: Super Admin Creates Resources
    print("\n" + "="*80)
    print("SCENARIO 3: Super Admin Creates Organization, Company, Accounts")
    print("="*80)
    results["superadmin_create_org"] = test_superadmin_create_organization()
    results["superadmin_create_company"] = test_superadmin_create_cleaning_company()
    results["superadmin_create_accounts"] = test_superadmin_create_accounts()
    
    # Scenario 4: Organization Admin Workflow
    print("\n" + "="*80)
    print("SCENARIO 4: Organization Admin Creates Building, Zone, Checklist, Assignment")
    print("="*80)
    results["org_admin_building"] = test_org_admin_create_building()
    results["org_admin_zone"] = test_org_admin_create_zone()
    results["org_admin_checklist"] = test_org_admin_create_checklist()
    results["org_admin_assignment"] = test_org_admin_create_assignment()
    
    # Scenario 5: Cleaning Admin Workflow
    print("\n" + "="*80)
    print("SCENARIO 5: Cleaning Admin Creates Cleaner and Assigns Task")
    print("="*80)
    results["cleaning_admin_create_cleaner"] = test_cleaning_admin_create_cleaner()
    results["cleaning_admin_assign_task"] = test_cleaning_admin_assign_task()
    
    # Scenario 6: Cleaner Workflow
    print("\n" + "="*80)
    print("SCENARIO 6: Cleaner Starts Task and Submits Report")
    print("="*80)
    results["cleaner_start_task"] = test_cleaner_start_task()
    results["cleaner_submit_report"] = test_cleaner_submit_report()
    
    # Scenario 7: Analytics
    print("\n" + "="*80)
    print("SCENARIO 7: Analytics for All Roles")
    print("="*80)
    results["analytics_all_roles"] = test_analytics_all_roles()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    
    print("\nDetailed Results:")
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} - {test_name}")
    
    return results


if __name__ == "__main__":
    run_all_tests()
