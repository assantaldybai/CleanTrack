#!/usr/bin/env python3
"""
SKYX Super-Admin Backend Hardening Test Suite
Tests production-grade super-admin features: command center, tenant lifecycle, plans, audit, access controls
"""
import requests
import json
from datetime import datetime

# Test configuration - using external URL
BASE_URL = "https://5926fd46-0a17-4214-8e22-ef7c38b78339.preview.emergentagent.com/api"

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
# SETUP: Login all roles
# ============================================================================

def setup_login_all_roles():
    """Login all roles and store tokens"""
    print_test("SETUP: Login All Roles")
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


# ============================================================================
# TEST 1: Superadmin Command Center
# ============================================================================

def test_superadmin_command_center():
    """Test GET /api/super-admin/command-center returns platform data"""
    print_test("1. Superadmin Command Center")
    token = tokens.get("superadmin")
    if not token:
        print_result(False, "No token for superadmin")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(
            f"{BASE_URL}/super-admin/command-center",
            headers=headers,
            timeout=15
        )
        if response.status_code == 200:
            data = response.json()
            
            # Check required top-level keys
            required_keys = ["platform", "organizations", "cleaning_companies", "recent_audit", "plan_presets"]
            missing_keys = [k for k in required_keys if k not in data]
            if missing_keys:
                print_result(False, f"Missing keys: {missing_keys}")
                return False
            
            # Check platform data
            platform = data["platform"]
            platform_keys = ["health_score", "organizations_total", "organizations_active", "organizations_suspended",
                            "cleaning_companies_total", "companies_active", "users_total", "active_users",
                            "assignments_total", "completed", "overdue", "completion_rate", "average_quality", "risk_tenants"]
            missing_platform = [k for k in platform_keys if k not in platform]
            if missing_platform:
                print_result(False, f"Missing platform keys: {missing_platform}")
                return False
            
            print_result(True, f"Command center data received - Health: {platform['health_score']}, Orgs: {platform['organizations_total']}, Companies: {platform['cleaning_companies_total']}")
            
            # Check organizations matrix
            if data["organizations"]:
                org_sample = data["organizations"][0]
                if "organization" in org_sample and "usage" in org_sample and "risks" in org_sample:
                    print_result(True, f"Organizations matrix valid - Count: {len(data['organizations'])}")
                    # Store demo org for later tests
                    for org_data in data["organizations"]:
                        if org_data["organization"]["name"] == "Газпром демо":
                            test_data["demo_org"] = org_data["organization"]
                            break
                else:
                    print_result(False, "Organizations matrix missing required fields")
                    return False
            
            # Check cleaning companies matrix
            if data["cleaning_companies"]:
                company_sample = data["cleaning_companies"][0]
                if "company" in company_sample and "usage" in company_sample and "risks" in company_sample:
                    print_result(True, f"Cleaning companies matrix valid - Count: {len(data['cleaning_companies'])}")
                    # Store demo company for later tests
                    for company_data in data["cleaning_companies"]:
                        if company_data["company"]["name"] == "ЧистоСервис демо":
                            test_data["demo_company"] = company_data["company"]
                            break
                else:
                    print_result(False, "Cleaning companies matrix missing required fields")
                    return False
            
            # Check recent audit
            print_result(True, f"Recent audit logs - Count: {len(data['recent_audit'])}")
            
            # Check plan presets
            if "beta" in data["plan_presets"] and "growth" in data["plan_presets"] and "enterprise" in data["plan_presets"]:
                print_result(True, f"Plan presets valid - Plans: {list(data['plan_presets'].keys())}")
            else:
                print_result(False, "Plan presets missing expected plans")
                return False
            
            # Verify no Mongo _id leaks (check for "_id" as a key, not substring)
            data_str = json.dumps(data)
            if '"_id"' in data_str:
                print_result(False, "CRITICAL: Mongo _id leaked in response")
                return False
            else:
                print_result(True, "No Mongo _id leaks detected")
            
            return True
        else:
            print_result(False, f"Command center failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(str(e))
        return False


# ============================================================================
# TEST 2: Audit Log Access Control
# ============================================================================

def test_audit_log_access_control():
    """Test GET /api/super-admin/audit-log works for superadmin and is forbidden for other roles"""
    print_test("2. Audit Log Access Control")
    all_success = True
    
    # Test superadmin can access
    token = tokens.get("superadmin")
    if token:
        try:
            response = requests.get(
                f"{BASE_URL}/super-admin/audit-log",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            if response.status_code == 200:
                logs = response.json()
                print_result(True, f"Superadmin can access audit log - Count: {len(logs)}")
            else:
                print_result(False, f"Superadmin audit log failed: {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"Superadmin audit log error: {str(e)}")
            all_success = False
    
    # Test other roles are forbidden
    forbidden_roles = ["org_gazprom", "cleaning_admin", "cleaner_maria"]
    for role_key in forbidden_roles:
        token = tokens.get(role_key)
        if token:
            try:
                response = requests.get(
                    f"{BASE_URL}/super-admin/audit-log",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=10
                )
                if response.status_code == 403:
                    print_result(True, f"{role_key} correctly forbidden from audit log (403)")
                else:
                    print_result(False, f"{role_key} expected 403, got {response.status_code}")
                    all_success = False
            except Exception as e:
                print_error(f"{role_key} audit log error: {str(e)}")
                all_success = False
    
    return all_success


# ============================================================================
# TEST 3: Organization Status Management
# ============================================================================

def test_organization_status_management():
    """Test PATCH /api/super-admin/organizations/{id}/status supports suspended/active/archived"""
    print_test("3. Organization Status Management")
    token = tokens.get("superadmin")
    if not token:
        print_result(False, "No token for superadmin")
        return False
    
    if "demo_org" not in test_data:
        print_result(False, "No demo org available")
        return False
    
    org_id = test_data["demo_org"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    all_success = True
    
    # Test suspend organization
    try:
        response = requests.patch(
            f"{BASE_URL}/super-admin/organizations/{org_id}/status",
            headers=headers,
            json={"status": "suspended", "reason": "Test suspension"},
            timeout=10
        )
        if response.status_code == 200:
            org = response.json()
            if org["status"] == "suspended":
                print_result(True, f"Organization suspended - Status: {org['status']}")
                test_data["org_suspended"] = True
            else:
                print_result(False, f"Expected status 'suspended', got '{org['status']}'")
                all_success = False
        else:
            print_result(False, f"Suspend org failed: {response.status_code} - {response.text}")
            all_success = False
    except Exception as e:
        print_error(f"Suspend org error: {str(e)}")
        all_success = False
    
    # Test org admin cannot access protected routes when suspended
    org_token = tokens.get("org_gazprom")
    if org_token and test_data.get("org_suspended"):
        try:
            response = requests.get(
                f"{BASE_URL}/buildings",
                headers={"Authorization": f"Bearer {org_token}"},
                timeout=10
            )
            if response.status_code == 403:
                print_result(True, "Suspended org admin correctly blocked from protected routes (403)")
            else:
                print_result(False, f"Suspended org admin expected 403, got {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"Suspended org access test error: {str(e)}")
            all_success = False
    
    # Test restore to active
    try:
        response = requests.patch(
            f"{BASE_URL}/super-admin/organizations/{org_id}/status",
            headers=headers,
            json={"status": "active", "reason": "Test restoration"},
            timeout=10
        )
        if response.status_code == 200:
            org = response.json()
            if org["status"] == "active":
                print_result(True, f"Organization restored to active - Status: {org['status']}")
                test_data["org_suspended"] = False
            else:
                print_result(False, f"Expected status 'active', got '{org['status']}'")
                all_success = False
        else:
            print_result(False, f"Restore org failed: {response.status_code} - {response.text}")
            all_success = False
    except Exception as e:
        print_error(f"Restore org error: {str(e)}")
        all_success = False
    
    # Test org admin can access after restoration
    if org_token and not test_data.get("org_suspended"):
        try:
            response = requests.get(
                f"{BASE_URL}/buildings",
                headers={"Authorization": f"Bearer {org_token}"},
                timeout=10
            )
            if response.status_code == 200:
                print_result(True, "Restored org admin can access protected routes")
            else:
                print_result(False, f"Restored org admin access failed: {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"Restored org access test error: {str(e)}")
            all_success = False
    
    # Test archived status
    try:
        response = requests.patch(
            f"{BASE_URL}/super-admin/organizations/{org_id}/status",
            headers=headers,
            json={"status": "archived", "reason": "Test archival"},
            timeout=10
        )
        if response.status_code == 200:
            org = response.json()
            if org["status"] == "archived" and org.get("is_active") == False:
                print_result(True, f"Organization archived - Status: {org['status']}, is_active: {org.get('is_active')}")
            else:
                print_result(False, f"Archived org has unexpected values - Status: {org['status']}, is_active: {org.get('is_active')}")
                all_success = False
        else:
            print_result(False, f"Archive org failed: {response.status_code} - {response.text}")
            all_success = False
    except Exception as e:
        print_error(f"Archive org error: {str(e)}")
        all_success = False
    
    # Restore to active to not leave demo org suspended
    try:
        response = requests.patch(
            f"{BASE_URL}/super-admin/organizations/{org_id}/status",
            headers=headers,
            json={"status": "active", "reason": "Restore after test"},
            timeout=10
        )
        if response.status_code == 200:
            print_result(True, "Demo org restored to active after test")
        else:
            print_result(False, f"Failed to restore demo org: {response.status_code}")
            all_success = False
    except Exception as e:
        print_error(f"Final restore error: {str(e)}")
        all_success = False
    
    return all_success


# ============================================================================
# TEST 4: Organization Plan Updates
# ============================================================================

def test_organization_plan_updates():
    """Test PATCH /api/super-admin/organizations/{id}/plan updates subscription_plan and limits"""
    print_test("4. Organization Plan Updates")
    token = tokens.get("superadmin")
    if not token:
        print_result(False, "No token for superadmin")
        return False
    
    if "demo_org" not in test_data:
        print_result(False, "No demo org available")
        return False
    
    org_id = test_data["demo_org"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    all_success = True
    
    # Test update to growth plan
    try:
        response = requests.patch(
            f"{BASE_URL}/super-admin/organizations/{org_id}/plan",
            headers=headers,
            json={
                "subscription_plan": "growth",
                "limits": {"max_buildings": 75, "max_cleaners": 600},
                "notes": "Upgraded to growth plan for testing"
            },
            timeout=10
        )
        if response.status_code == 200:
            org = response.json()
            if org["subscription_plan"] == "growth":
                print_result(True, f"Plan updated to growth - Plan: {org['subscription_plan']}")
                if org.get("limits", {}).get("max_buildings") == 75:
                    print_result(True, f"Custom limits applied - max_buildings: {org['limits']['max_buildings']}")
                else:
                    print_result(False, f"Custom limits not applied correctly - max_buildings: {org.get('limits', {}).get('max_buildings')}")
                    all_success = False
            else:
                print_result(False, f"Expected plan 'growth', got '{org['subscription_plan']}'")
                all_success = False
        else:
            print_result(False, f"Update plan failed: {response.status_code} - {response.text}")
            all_success = False
    except Exception as e:
        print_error(f"Update plan error: {str(e)}")
        all_success = False
    
    # Restore to original enterprise plan
    try:
        response = requests.patch(
            f"{BASE_URL}/super-admin/organizations/{org_id}/plan",
            headers=headers,
            json={
                "subscription_plan": "enterprise",
                "notes": "Restored to enterprise after test"
            },
            timeout=10
        )
        if response.status_code == 200:
            print_result(True, "Demo org plan restored to enterprise")
        else:
            print_result(False, f"Failed to restore plan: {response.status_code}")
            all_success = False
    except Exception as e:
        print_error(f"Restore plan error: {str(e)}")
        all_success = False
    
    return all_success


# ============================================================================
# TEST 5: Cleaning Company Status Management
# ============================================================================

def test_cleaning_company_status_management():
    """Test PATCH /api/super-admin/cleaning-companies/{id}/status supports suspended/active"""
    print_test("5. Cleaning Company Status Management")
    token = tokens.get("superadmin")
    if not token:
        print_result(False, "No token for superadmin")
        return False
    
    if "demo_company" not in test_data:
        print_result(False, "No demo company available")
        return False
    
    company_id = test_data["demo_company"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    all_success = True
    
    # Test suspend company
    try:
        response = requests.patch(
            f"{BASE_URL}/super-admin/cleaning-companies/{company_id}/status",
            headers=headers,
            json={"status": "suspended", "reason": "Test suspension"},
            timeout=10
        )
        if response.status_code == 200:
            company = response.json()
            if company["status"] == "suspended":
                print_result(True, f"Company suspended - Status: {company['status']}")
                test_data["company_suspended"] = True
            else:
                print_result(False, f"Expected status 'suspended', got '{company['status']}'")
                all_success = False
        else:
            print_result(False, f"Suspend company failed: {response.status_code} - {response.text}")
            all_success = False
    except Exception as e:
        print_error(f"Suspend company error: {str(e)}")
        all_success = False
    
    # Test cleaning admin cannot access when suspended
    cleaning_token = tokens.get("cleaning_admin")
    if cleaning_token and test_data.get("company_suspended"):
        try:
            response = requests.get(
                f"{BASE_URL}/assignments",
                headers={"Authorization": f"Bearer {cleaning_token}"},
                timeout=10
            )
            if response.status_code == 403:
                print_result(True, "Suspended cleaning admin correctly blocked (403)")
            else:
                print_result(False, f"Suspended cleaning admin expected 403, got {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"Suspended cleaning admin test error: {str(e)}")
            all_success = False
    
    # Test cleaner cannot access when company suspended
    cleaner_token = tokens.get("cleaner_maria")
    if cleaner_token and test_data.get("company_suspended"):
        try:
            response = requests.get(
                f"{BASE_URL}/assignments",
                headers={"Authorization": f"Bearer {cleaner_token}"},
                timeout=10
            )
            if response.status_code == 403:
                print_result(True, "Suspended company cleaner correctly blocked (403)")
            else:
                print_result(False, f"Suspended cleaner expected 403, got {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"Suspended cleaner test error: {str(e)}")
            all_success = False
    
    # Test restore to active
    try:
        response = requests.patch(
            f"{BASE_URL}/super-admin/cleaning-companies/{company_id}/status",
            headers=headers,
            json={"status": "active", "reason": "Test restoration"},
            timeout=10
        )
        if response.status_code == 200:
            company = response.json()
            if company["status"] == "active":
                print_result(True, f"Company restored to active - Status: {company['status']}")
                test_data["company_suspended"] = False
            else:
                print_result(False, f"Expected status 'active', got '{company['status']}'")
                all_success = False
        else:
            print_result(False, f"Restore company failed: {response.status_code} - {response.text}")
            all_success = False
    except Exception as e:
        print_error(f"Restore company error: {str(e)}")
        all_success = False
    
    # Test cleaning admin can access after restoration
    if cleaning_token and not test_data.get("company_suspended"):
        try:
            response = requests.get(
                f"{BASE_URL}/assignments",
                headers={"Authorization": f"Bearer {cleaning_token}"},
                timeout=10
            )
            if response.status_code == 200:
                print_result(True, "Restored cleaning admin can access")
            else:
                print_result(False, f"Restored cleaning admin access failed: {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"Restored cleaning admin test error: {str(e)}")
            all_success = False
    
    # Test cleaner can access after restoration
    if cleaner_token and not test_data.get("company_suspended"):
        try:
            response = requests.get(
                f"{BASE_URL}/assignments",
                headers={"Authorization": f"Bearer {cleaner_token}"},
                timeout=10
            )
            if response.status_code == 200:
                print_result(True, "Restored cleaner can access")
            else:
                print_result(False, f"Restored cleaner access failed: {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"Restored cleaner test error: {str(e)}")
            all_success = False
    
    return all_success


# ============================================================================
# TEST 6: Cleaning Company Plan Updates
# ============================================================================

def test_cleaning_company_plan_updates():
    """Test PATCH /api/super-admin/cleaning-companies/{id}/plan updates plan/limits"""
    print_test("6. Cleaning Company Plan Updates")
    token = tokens.get("superadmin")
    if not token:
        print_result(False, "No token for superadmin")
        return False
    
    if "demo_company" not in test_data:
        print_result(False, "No demo company available")
        return False
    
    company_id = test_data["demo_company"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    all_success = True
    
    # Test update to beta plan
    try:
        response = requests.patch(
            f"{BASE_URL}/super-admin/cleaning-companies/{company_id}/plan",
            headers=headers,
            json={
                "subscription_plan": "beta",
                "limits": {"max_cleaners": 75, "max_monthly_assignments": 1500},
                "notes": "Downgraded to beta for testing"
            },
            timeout=10
        )
        if response.status_code == 200:
            company = response.json()
            if company["subscription_plan"] == "beta":
                print_result(True, f"Plan updated to beta - Plan: {company['subscription_plan']}")
                if company.get("limits", {}).get("max_cleaners") == 75:
                    print_result(True, f"Custom limits applied - max_cleaners: {company['limits']['max_cleaners']}")
                else:
                    print_result(False, f"Custom limits not applied correctly - max_cleaners: {company.get('limits', {}).get('max_cleaners')}")
                    all_success = False
            else:
                print_result(False, f"Expected plan 'beta', got '{company['subscription_plan']}'")
                all_success = False
        else:
            print_result(False, f"Update plan failed: {response.status_code} - {response.text}")
            all_success = False
    except Exception as e:
        print_error(f"Update plan error: {str(e)}")
        all_success = False
    
    # Restore to original growth plan
    try:
        response = requests.patch(
            f"{BASE_URL}/super-admin/cleaning-companies/{company_id}/plan",
            headers=headers,
            json={
                "subscription_plan": "growth",
                "notes": "Restored to growth after test"
            },
            timeout=10
        )
        if response.status_code == 200:
            print_result(True, "Demo company plan restored to growth")
        else:
            print_result(False, f"Failed to restore plan: {response.status_code}")
            all_success = False
    except Exception as e:
        print_error(f"Restore plan error: {str(e)}")
        all_success = False
    
    return all_success


# ============================================================================
# TEST 7: Cleaning Company Organization Links
# ============================================================================

def test_cleaning_company_organization_links():
    """Test PATCH /api/super-admin/cleaning-companies/{id}/organizations updates organization links"""
    print_test("7. Cleaning Company Organization Links")
    token = tokens.get("superadmin")
    if not token:
        print_result(False, "No token for superadmin")
        return False
    
    if "demo_company" not in test_data or "demo_org" not in test_data:
        print_result(False, "No demo company or org available")
        return False
    
    company_id = test_data["demo_company"]["id"]
    org_id = test_data["demo_org"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    all_success = True
    
    # Test update organization links (remove all)
    try:
        response = requests.patch(
            f"{BASE_URL}/super-admin/cleaning-companies/{company_id}/organizations",
            headers=headers,
            json={
                "organization_ids": [],
                "reason": "Test unlinking all organizations"
            },
            timeout=10
        )
        if response.status_code == 200:
            company = response.json()
            if company.get("organization_ids") == []:
                print_result(True, f"Organization links cleared - Links: {company['organization_ids']}")
            else:
                print_result(False, f"Expected empty links, got {company.get('organization_ids')}")
                all_success = False
        else:
            print_result(False, f"Update links failed: {response.status_code} - {response.text}")
            all_success = False
    except Exception as e:
        print_error(f"Update links error: {str(e)}")
        all_success = False
    
    # Test restore original link
    try:
        response = requests.patch(
            f"{BASE_URL}/super-admin/cleaning-companies/{company_id}/organizations",
            headers=headers,
            json={
                "organization_ids": [org_id],
                "reason": "Restore original link"
            },
            timeout=10
        )
        if response.status_code == 200:
            company = response.json()
            if org_id in company.get("organization_ids", []):
                print_result(True, f"Organization link restored - Links: {company['organization_ids']}")
            else:
                print_result(False, f"Link not restored correctly - Links: {company.get('organization_ids')}")
                all_success = False
        else:
            print_result(False, f"Restore link failed: {response.status_code} - {response.text}")
            all_success = False
    except Exception as e:
        print_error(f"Restore link error: {str(e)}")
        all_success = False
    
    # Test validation of non-existent org IDs
    try:
        response = requests.patch(
            f"{BASE_URL}/super-admin/cleaning-companies/{company_id}/organizations",
            headers=headers,
            json={
                "organization_ids": ["non-existent-org-id-12345"],
                "reason": "Test validation"
            },
            timeout=10
        )
        if response.status_code == 400:
            print_result(True, "Non-existent org ID correctly rejected (400)")
        else:
            print_result(False, f"Expected 400 for invalid org ID, got {response.status_code}")
            all_success = False
    except Exception as e:
        print_error(f"Validation test error: {str(e)}")
        all_success = False
    
    return all_success


# ============================================================================
# TEST 8: User Status (Block/Unblock)
# ============================================================================

def test_user_status_block_unblock():
    """Test PATCH /api/super-admin/users/{id}/status blocks/unblocks users"""
    print_test("8. User Status (Block/Unblock)")
    token = tokens.get("superadmin")
    if not token:
        print_result(False, "No token for superadmin")
        return False
    
    # Get cleaner user ID
    cleaner_user = test_data.get("cleaner_maria_user")
    if not cleaner_user:
        print_result(False, "No cleaner user available")
        return False
    
    user_id = cleaner_user["id"]
    headers = {"Authorization": f"Bearer {token}"}
    all_success = True
    
    # Test block user
    try:
        response = requests.patch(
            f"{BASE_URL}/super-admin/users/{user_id}/status",
            headers=headers,
            json={
                "is_active": False,
                "reason": "Test blocking user"
            },
            timeout=10
        )
        if response.status_code == 200:
            user = response.json()
            if user.get("is_active") == False:
                print_result(True, f"User blocked - is_active: {user['is_active']}")
                test_data["user_blocked"] = True
            else:
                print_result(False, f"Expected is_active False, got {user.get('is_active')}")
                all_success = False
        else:
            print_result(False, f"Block user failed: {response.status_code} - {response.text}")
            all_success = False
    except Exception as e:
        print_error(f"Block user error: {str(e)}")
        all_success = False
    
    # Test blocked user cannot login
    if test_data.get("user_blocked"):
        try:
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json=CREDENTIALS["cleaner_maria"],
                timeout=10
            )
            if response.status_code == 401:
                print_result(True, "Blocked user cannot login (401)")
            else:
                print_result(False, f"Blocked user login expected 401, got {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"Blocked user login test error: {str(e)}")
            all_success = False
    
    # Test unblock user
    try:
        response = requests.patch(
            f"{BASE_URL}/super-admin/users/{user_id}/status",
            headers=headers,
            json={
                "is_active": True,
                "reason": "Test unblocking user"
            },
            timeout=10
        )
        if response.status_code == 200:
            user = response.json()
            if user.get("is_active") == True:
                print_result(True, f"User unblocked - is_active: {user['is_active']}")
                test_data["user_blocked"] = False
            else:
                print_result(False, f"Expected is_active True, got {user.get('is_active')}")
                all_success = False
        else:
            print_result(False, f"Unblock user failed: {response.status_code} - {response.text}")
            all_success = False
    except Exception as e:
        print_error(f"Unblock user error: {str(e)}")
        all_success = False
    
    # Test unblocked user can login
    if not test_data.get("user_blocked"):
        try:
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json=CREDENTIALS["cleaner_maria"],
                timeout=10
            )
            if response.status_code == 200:
                print_result(True, "Unblocked user can login")
                # Update token
                tokens["cleaner_maria"] = response.json()["token"]
            else:
                print_result(False, f"Unblocked user login failed: {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"Unblocked user login test error: {str(e)}")
            all_success = False
    
    # Test cannot block superadmin self
    superadmin_user = test_data.get("superadmin_user")
    if superadmin_user:
        try:
            response = requests.patch(
                f"{BASE_URL}/super-admin/users/{superadmin_user['id']}/status",
                headers=headers,
                json={
                    "is_active": False,
                    "reason": "Test self-block prevention"
                },
                timeout=10
            )
            if response.status_code == 400:
                print_result(True, "Superadmin cannot block self (400)")
            else:
                print_result(False, f"Expected 400 for self-block, got {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"Self-block test error: {str(e)}")
            all_success = False
    
    return all_success


# ============================================================================
# TEST 9: Audit Log Entries
# ============================================================================

def test_audit_log_entries():
    """Verify audit log gets entries for status/plan/link/user updates"""
    print_test("9. Audit Log Entries")
    token = tokens.get("superadmin")
    if not token:
        print_result(False, "No token for superadmin")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(
            f"{BASE_URL}/super-admin/audit-log",
            headers=headers,
            timeout=10
        )
        if response.status_code == 200:
            logs = response.json()
            
            # Check for expected audit actions
            actions = [log.get("action") for log in logs]
            
            expected_actions = [
                "organization.status_update",
                "organization.plan_update",
                "cleaning_company.status_update",
                "cleaning_company.plan_update",
                "cleaning_company.organization_links_update",
                "user.status_update"
            ]
            
            found_actions = [action for action in expected_actions if action in actions]
            
            if len(found_actions) >= 4:  # At least 4 of the 6 expected actions
                print_result(True, f"Audit log contains expected actions - Found: {len(found_actions)}/{len(expected_actions)}")
                print(f"Actions found: {found_actions}")
            else:
                print_result(False, f"Audit log missing expected actions - Found only: {found_actions}")
                return False
            
            # Check audit log structure
            if logs:
                sample = logs[0]
                required_fields = ["id", "actor_user_id", "actor_username", "actor_role", "action", 
                                 "target_type", "created_at"]
                missing_fields = [f for f in required_fields if f not in sample]
                if not missing_fields:
                    print_result(True, "Audit log entries have correct structure")
                else:
                    print_result(False, f"Audit log missing fields: {missing_fields}")
                    return False
            
            return True
        else:
            print_result(False, f"Audit log failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(str(e))
        return False


# ============================================================================
# TEST 10: Regression Smoke Tests
# ============================================================================

def test_regression_smoke():
    """Verify core workflow still works (organization list, cleaning company list, assignments list, analytics)"""
    print_test("10. Regression Smoke Tests")
    all_success = True
    
    # Test organization list
    token = tokens.get("superadmin")
    if token:
        try:
            response = requests.get(
                f"{BASE_URL}/organizations",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            if response.status_code == 200:
                orgs = response.json()
                print_result(True, f"Organization list works - Count: {len(orgs)}")
            else:
                print_result(False, f"Organization list failed: {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"Organization list error: {str(e)}")
            all_success = False
    
    # Test cleaning company list
    if token:
        try:
            response = requests.get(
                f"{BASE_URL}/cleaning-companies",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            if response.status_code == 200:
                companies = response.json()
                print_result(True, f"Cleaning company list works - Count: {len(companies)}")
            else:
                print_result(False, f"Cleaning company list failed: {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"Cleaning company list error: {str(e)}")
            all_success = False
    
    # Test assignments list
    if token:
        try:
            response = requests.get(
                f"{BASE_URL}/assignments",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            if response.status_code == 200:
                assignments = response.json()
                print_result(True, f"Assignments list works - Count: {len(assignments)}")
            else:
                print_result(False, f"Assignments list failed: {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"Assignments list error: {str(e)}")
            all_success = False
    
    # Test analytics overview
    if token:
        try:
            response = requests.get(
                f"{BASE_URL}/analytics/overview",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            if response.status_code == 200:
                analytics = response.json()
                print_result(True, f"Analytics overview works - Assignments: {analytics.get('assignments_total')}, Completed: {analytics.get('completed')}")
            else:
                print_result(False, f"Analytics overview failed: {response.status_code}")
                all_success = False
        except Exception as e:
            print_error(f"Analytics overview error: {str(e)}")
            all_success = False
    
    return all_success


# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def run_all_tests():
    """Run all super-admin hardening tests"""
    print("\n" + "="*80)
    print("SKYX SUPER-ADMIN BACKEND HARDENING TEST SUITE")
    print("="*80)
    
    results = {}
    
    # Setup
    print("\n" + "="*80)
    print("SETUP")
    print("="*80)
    if not setup_login_all_roles():
        print("\n❌ SETUP FAILED - Cannot proceed with tests")
        return
    
    # Run tests
    print("\n" + "="*80)
    print("SUPER-ADMIN HARDENING TESTS")
    print("="*80)
    
    results["1_command_center"] = test_superadmin_command_center()
    results["2_audit_log_access"] = test_audit_log_access_control()
    results["3_org_status"] = test_organization_status_management()
    results["4_org_plan"] = test_organization_plan_updates()
    results["5_company_status"] = test_cleaning_company_status_management()
    results["6_company_plan"] = test_cleaning_company_plan_updates()
    results["7_company_links"] = test_cleaning_company_organization_links()
    results["8_user_status"] = test_user_status_block_unblock()
    results["9_audit_entries"] = test_audit_log_entries()
    results["10_regression"] = test_regression_smoke()
    
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
