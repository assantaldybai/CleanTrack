#!/usr/bin/env python3
"""
SKYX Backend Regression Test - N+1 Query Optimization
Tests deployment blocker fix for /api/assignments and /api/super-admin/command-center
"""
import requests
import json
from typing import Dict, Any, List

# Use external URL from frontend/.env
BASE_URL = "https://clean-task-hub-1.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
CREDENTIALS = {
    "superadmin": {"username": "superadmin", "password": "Super2025!"},
    "org_gazprom": {"username": "org_gazprom", "password": "Org2025!"},
    "cleaning_admin": {"username": "cleaning_admin", "password": "Clean2025!"},
    "cleaner_maria": {"username": "cleaner_maria", "password": "Cleaner2025!"},
}

# Store tokens
tokens = {}
test_results = {
    "passed": 0,
    "failed": 0,
    "tests": []
}


def print_test(name):
    """Print test name"""
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)


def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    test_results["tests"].append({"name": message, "passed": success})
    if success:
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1


def print_error(error):
    """Print error details"""
    print(f"ERROR: {error}")


def check_no_mongo_id(data: Any, path: str = "root") -> List[str]:
    """Recursively check for MongoDB _id fields"""
    issues = []
    if isinstance(data, dict):
        if "_id" in data:
            issues.append(f"Found _id at {path}")
        for key, value in data.items():
            issues.extend(check_no_mongo_id(value, f"{path}.{key}"))
    elif isinstance(data, list):
        for i, item in enumerate(data):
            issues.extend(check_no_mongo_id(item, f"{path}[{i}]"))
    return issues


# ============================================================================
# TEST 1: Auth Login for All Roles
# ============================================================================

def test_login_all_roles():
    """Test login for all four roles"""
    print_test("1. Auth Login for All Roles")
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
                print_result(True, f"{role_key} login successful - Role: {data['user']['role']}")
            else:
                print_result(False, f"{role_key} login failed with status {response.status_code}: {response.text}")
                all_success = False
        except Exception as e:
            print_error(f"{role_key} login error: {str(e)}")
            print_result(False, f"{role_key} login exception")
            all_success = False
    
    return all_success


# ============================================================================
# TEST 2: /api/assignments Enrichment and RLS
# ============================================================================

def test_assignments_enrichment_superadmin():
    """Test /api/assignments returns enriched data for superadmin"""
    print_test("2a. /api/assignments Enrichment - Superadmin")
    
    if "superadmin" not in tokens:
        print_result(False, "Superadmin token not available")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/assignments",
            headers={"Authorization": f"Bearer {tokens['superadmin']}"},
            timeout=10
        )
        
        if response.status_code != 200:
            print_result(False, f"Status {response.status_code}: {response.text}")
            return False
        
        assignments = response.json()
        print(f"Superadmin sees {len(assignments)} assignments")
        
        if not assignments:
            print_result(True, "No assignments to test (empty DB is valid)")
            return True
        
        # Check enrichment fields
        required_fields = [
            "zone_name", "building_name", "checklist_name", 
            "checklist_items", "cleaning_company_name", 
            "cleaner_name", "organization_name"
        ]
        
        sample = assignments[0]
        missing_fields = [f for f in required_fields if f not in sample]
        
        if missing_fields:
            print_result(False, f"Missing enrichment fields: {missing_fields}")
            print(f"Sample assignment keys: {list(sample.keys())}")
            return False
        
        print(f"Sample assignment enrichment:")
        print(f"  - zone_name: {sample.get('zone_name')}")
        print(f"  - building_name: {sample.get('building_name')}")
        print(f"  - checklist_name: {sample.get('checklist_name')}")
        print(f"  - cleaning_company_name: {sample.get('cleaning_company_name')}")
        print(f"  - cleaner_name: {sample.get('cleaner_name')}")
        print(f"  - organization_name: {sample.get('organization_name')}")
        
        print_result(True, f"Superadmin assignments enriched correctly ({len(assignments)} assignments)")
        return True
        
    except Exception as e:
        print_error(str(e))
        print_result(False, "Superadmin assignments exception")
        return False


def test_assignments_rls_org_admin():
    """Test /api/assignments RLS for org admin"""
    print_test("2b. /api/assignments RLS - Organization Admin")
    
    if "org_gazprom" not in tokens:
        print_result(False, "Org admin token not available")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/assignments",
            headers={"Authorization": f"Bearer {tokens['org_gazprom']}"},
            timeout=10
        )
        
        if response.status_code != 200:
            print_result(False, f"Status {response.status_code}: {response.text}")
            return False
        
        assignments = response.json()
        print(f"Org admin sees {len(assignments)} assignments")
        
        if not assignments:
            print_result(True, "Org admin sees no assignments (RLS working, empty scope is valid)")
            return True
        
        # Verify all assignments belong to org admin's organization
        org_admin_org_id = None
        for assignment in assignments:
            if org_admin_org_id is None:
                org_admin_org_id = assignment.get("organization_id")
            elif assignment.get("organization_id") != org_admin_org_id:
                print_result(False, f"RLS violation: assignment {assignment.get('id')} has different org_id")
                return False
        
        # Check enrichment
        sample = assignments[0]
        if "zone_name" not in sample or "building_name" not in sample:
            print_result(False, "Org admin assignments missing enrichment")
            return False
        
        print_result(True, f"Org admin RLS working, enrichment present ({len(assignments)} assignments)")
        return True
        
    except Exception as e:
        print_error(str(e))
        print_result(False, "Org admin assignments exception")
        return False


def test_assignments_rls_cleaning_admin():
    """Test /api/assignments RLS for cleaning admin"""
    print_test("2c. /api/assignments RLS - Cleaning Admin")
    
    if "cleaning_admin" not in tokens:
        print_result(False, "Cleaning admin token not available")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/assignments",
            headers={"Authorization": f"Bearer {tokens['cleaning_admin']}"},
            timeout=10
        )
        
        if response.status_code != 200:
            print_result(False, f"Status {response.status_code}: {response.text}")
            return False
        
        assignments = response.json()
        print(f"Cleaning admin sees {len(assignments)} assignments")
        
        if not assignments:
            print_result(True, "Cleaning admin sees no assignments (RLS working, empty scope is valid)")
            return True
        
        # Verify all assignments belong to cleaning admin's company
        company_id = None
        for assignment in assignments:
            if company_id is None:
                company_id = assignment.get("cleaning_company_id")
            elif assignment.get("cleaning_company_id") != company_id:
                print_result(False, f"RLS violation: assignment {assignment.get('id')} has different company_id")
                return False
        
        # Check enrichment
        sample = assignments[0]
        if "zone_name" not in sample or "cleaning_company_name" not in sample:
            print_result(False, "Cleaning admin assignments missing enrichment")
            return False
        
        print_result(True, f"Cleaning admin RLS working, enrichment present ({len(assignments)} assignments)")
        return True
        
    except Exception as e:
        print_error(str(e))
        print_result(False, "Cleaning admin assignments exception")
        return False


def test_assignments_rls_cleaner():
    """Test /api/assignments RLS for cleaner"""
    print_test("2d. /api/assignments RLS - Cleaner")
    
    if "cleaner_maria" not in tokens:
        print_result(False, "Cleaner token not available")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/assignments",
            headers={"Authorization": f"Bearer {tokens['cleaner_maria']}"},
            timeout=10
        )
        
        if response.status_code != 200:
            print_result(False, f"Status {response.status_code}: {response.text}")
            return False
        
        assignments = response.json()
        print(f"Cleaner sees {len(assignments)} assignments")
        
        if not assignments:
            print_result(True, "Cleaner sees no assignments (RLS working, empty scope is valid)")
            return True
        
        # Verify all assignments belong to cleaner
        cleaner_user_id = None
        for assignment in assignments:
            if cleaner_user_id is None:
                cleaner_user_id = assignment.get("cleaner_user_id")
            elif assignment.get("cleaner_user_id") != cleaner_user_id:
                print_result(False, f"RLS violation: assignment {assignment.get('id')} has different cleaner_user_id")
                return False
        
        # Check enrichment
        sample = assignments[0]
        if "zone_name" not in sample or "cleaner_name" not in sample:
            print_result(False, "Cleaner assignments missing enrichment")
            return False
        
        print_result(True, f"Cleaner RLS working, enrichment present ({len(assignments)} assignments)")
        return True
        
    except Exception as e:
        print_error(str(e))
        print_result(False, "Cleaner assignments exception")
        return False


# ============================================================================
# TEST 3: /api/super-admin/command-center
# ============================================================================

def test_command_center_superadmin():
    """Test /api/super-admin/command-center returns correct data"""
    print_test("3a. /api/super-admin/command-center - Superadmin Access")
    
    if "superadmin" not in tokens:
        print_result(False, "Superadmin token not available")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/super-admin/command-center",
            headers={"Authorization": f"Bearer {tokens['superadmin']}"},
            timeout=10
        )
        
        if response.status_code != 200:
            print_result(False, f"Status {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        
        # Check required top-level keys
        required_keys = ["platform", "organizations", "cleaning_companies", "recent_audit", "plan_presets"]
        missing_keys = [k for k in required_keys if k not in data]
        
        if missing_keys:
            print_result(False, f"Missing keys: {missing_keys}")
            return False
        
        # Check platform metrics
        platform = data["platform"]
        platform_metrics = [
            "health_score", "organizations_total", "organizations_active",
            "cleaning_companies_total", "users_total", "assignments_total"
        ]
        missing_metrics = [m for m in platform_metrics if m not in platform]
        
        if missing_metrics:
            print_result(False, f"Missing platform metrics: {missing_metrics}")
            return False
        
        print(f"Platform metrics:")
        print(f"  - health_score: {platform.get('health_score')}")
        print(f"  - organizations_total: {platform.get('organizations_total')}")
        print(f"  - companies_total: {platform.get('cleaning_companies_total')}")
        print(f"  - users_total: {platform.get('users_total')}")
        print(f"  - assignments_total: {platform.get('assignments_total')}")
        
        # Check organizations matrix
        orgs = data["organizations"]
        print(f"Organizations matrix: {len(orgs)} organizations")
        
        # Check cleaning_companies matrix
        companies = data["cleaning_companies"]
        print(f"Cleaning companies matrix: {len(companies)} companies")
        
        # Check recent_audit
        audit = data["recent_audit"]
        print(f"Recent audit logs: {len(audit)} entries")
        
        # Check plan_presets
        presets = data["plan_presets"]
        if "beta" not in presets or "growth" not in presets or "enterprise" not in presets:
            print_result(False, "Missing plan presets")
            return False
        
        print(f"Plan presets: {list(presets.keys())}")
        
        # Check for Mongo _id leaks
        mongo_id_issues = check_no_mongo_id(data)
        if mongo_id_issues:
            print_result(False, f"Mongo _id leaks detected: {mongo_id_issues[:3]}")
            return False
        
        print_result(True, "Command center returns correct data structure, no _id leaks")
        return True
        
    except Exception as e:
        print_error(str(e))
        print_result(False, "Command center exception")
        return False


def test_command_center_access_control():
    """Test non-superadmin roles get 403 for command-center"""
    print_test("3b. /api/super-admin/command-center - Access Control")
    
    non_superadmin_roles = ["org_gazprom", "cleaning_admin", "cleaner_maria"]
    all_success = True
    
    for role_key in non_superadmin_roles:
        if role_key not in tokens:
            print_result(False, f"{role_key} token not available")
            all_success = False
            continue
        
        try:
            response = requests.get(
                f"{BASE_URL}/super-admin/command-center",
                headers={"Authorization": f"Bearer {tokens[role_key]}"},
                timeout=10
            )
            
            if response.status_code == 403:
                print_result(True, f"{role_key} correctly denied (403)")
            else:
                print_result(False, f"{role_key} got status {response.status_code} instead of 403")
                all_success = False
                
        except Exception as e:
            print_error(f"{role_key}: {str(e)}")
            print_result(False, f"{role_key} exception")
            all_success = False
    
    return all_success


# ============================================================================
# TEST 4: Regression Smoke Tests
# ============================================================================

def test_analytics_overview():
    """Test /api/analytics/overview for all roles"""
    print_test("4. Regression Smoke - Analytics Overview")
    
    all_success = True
    
    for role_key in ["superadmin", "org_gazprom", "cleaning_admin", "cleaner_maria"]:
        if role_key not in tokens:
            print_result(False, f"{role_key} token not available")
            all_success = False
            continue
        
        try:
            response = requests.get(
                f"{BASE_URL}/analytics/overview",
                headers={"Authorization": f"Bearer {tokens[role_key]}"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                # Check basic structure
                if "assignments_total" in data and "completed" in data:
                    print_result(True, f"{role_key} analytics working")
                else:
                    print_result(False, f"{role_key} analytics missing fields")
                    all_success = False
            else:
                print_result(False, f"{role_key} analytics status {response.status_code}")
                all_success = False
                
        except Exception as e:
            print_error(f"{role_key}: {str(e)}")
            print_result(False, f"{role_key} analytics exception")
            all_success = False
    
    return all_success


# ============================================================================
# Main Test Runner
# ============================================================================

def main():
    print("\n" + "="*80)
    print("SKYX BACKEND REGRESSION TEST - N+1 Query Optimization")
    print("Testing deployment blocker fix for /api/assignments and command-center")
    print("="*80)
    
    # Run all tests
    test_login_all_roles()
    test_assignments_enrichment_superadmin()
    test_assignments_rls_org_admin()
    test_assignments_rls_cleaning_admin()
    test_assignments_rls_cleaner()
    test_command_center_superadmin()
    test_command_center_access_control()
    test_analytics_overview()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total Tests: {test_results['passed'] + test_results['failed']}")
    print(f"✅ Passed: {test_results['passed']}")
    print(f"❌ Failed: {test_results['failed']}")
    
    if test_results['failed'] > 0:
        print("\nFailed Tests:")
        for test in test_results['tests']:
            if not test['passed']:
                print(f"  - {test['name']}")
    
    success_rate = (test_results['passed'] / (test_results['passed'] + test_results['failed']) * 100) if (test_results['passed'] + test_results['failed']) > 0 else 0
    print(f"\nSuccess Rate: {success_rate:.1f}%")
    print("="*80)
    
    return test_results['failed'] == 0


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
