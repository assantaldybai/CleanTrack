from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.hash import pbkdf2_sha256
from jose import jwt, JWTError
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime, timedelta, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="SKYX Cleaning SaaS API", version="0.2.0-beta")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

JWT_SECRET = os.environ.get('JWT_SECRET', 'skyx-local-beta-secret-change-in-production')
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7

ROLES = {
    "super_admin": "Супер-админ SaaS",
    "organization_admin": "Администратор организации",
    "cleaning_company_admin": "Администратор клининга",
    "cleaner": "Клинер",
}

TENANT_STATUSES = ["active", "suspended", "archived"]
DEFAULT_ORG_LIMITS = {
    "max_buildings": 25,
    "max_cleaners": 250,
    "max_monthly_assignments": 5000,
}
DEFAULT_COMPANY_LIMITS = {
    "max_cleaners": 100,
    "max_monthly_assignments": 3000,
}
PLAN_PRESETS = {
    "beta": {"max_buildings": 10, "max_cleaners": 50, "max_monthly_assignments": 1000},
    "growth": {"max_buildings": 50, "max_cleaners": 500, "max_monthly_assignments": 15000},
    "enterprise": {"max_buildings": 500, "max_cleaners": 5000, "max_monthly_assignments": 250000},
}



def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def normalize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


def public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    clean = normalize_doc(dict(user))
    clean.pop("password_hash", None)
    return clean


async def find_one_public(collection: str, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    return normalize_doc(await db[collection].find_one(query))


async def find_many_public(collection: str, query: Dict[str, Any], limit: int = 1000) -> List[Dict[str, Any]]:
    docs = await db[collection].find(query).sort("created_at", -1).to_list(limit)
    return [normalize_doc(doc) for doc in docs]


def create_token(user: Dict[str, Any]) -> str:
    payload = {
        "sub": user["id"],
        "username": user["username"],
        "role": user["role"],
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недействительный токен") from exc

    user = await db.users.find_one({"id": user_id, "is_active": True})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
    user = normalize_doc(user)
    await validate_operational_user(user)
    return user


def require_roles(user: Dict[str, Any], allowed: List[str]) -> None:
    if user["role"] not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")


def org_scope(user: Dict[str, Any]) -> Dict[str, Any]:
    if user["role"] == "super_admin":
        return {}
    if user.get("organization_id"):
        return {"organization_id": user["organization_id"]}
    return {"organization_id": "__no_access__"}


def company_scope(user: Dict[str, Any]) -> Dict[str, Any]:
    if user["role"] == "super_admin":
        return {}
    if user.get("cleaning_company_id"):
        return {"cleaning_company_id": user["cleaning_company_id"]}
    return {"cleaning_company_id": "__no_access__"}


def assignment_scope(user: Dict[str, Any]) -> Dict[str, Any]:
    role = user["role"]
    if role == "super_admin":
        return {}
    if role == "organization_admin":
        return {"organization_id": user.get("organization_id")}
    if role == "cleaning_company_admin":
        return {"cleaning_company_id": user.get("cleaning_company_id")}
    if role == "cleaner":
        return {"cleaner_user_id": user["id"]}
    return {"id": "__no_access__"}


def assert_same_scope(doc: Dict[str, Any], query: Dict[str, Any]) -> None:
    for key, value in query.items():
        if value is not None and doc.get(key) != value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="RLS: доступ к чужим данным запрещен")


async def audit_log(
    actor: Optional[Dict[str, Any]],
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    before: Optional[Dict[str, Any]] = None,
    after: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    doc = {
        "id": new_id(),
        "actor_user_id": actor.get("id") if actor else None,
        "actor_username": actor.get("username") if actor else "system",
        "actor_role": actor.get("role") if actor else "system",
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "before": before,
        "after": after,
        "metadata": metadata or {},
        "created_at": now_iso(),
    }
    await db.audit_logs.insert_one(doc)


def month_prefix() -> str:
    return datetime.now(timezone.utc).date().isoformat()[:7]


def merge_limits(plan: str, custom_limits: Optional[Dict[str, int]], defaults: Dict[str, int]) -> Dict[str, int]:
    limits = dict(defaults)
    limits.update(PLAN_PRESETS.get(plan, {}))
    if custom_limits:
        limits.update({key: int(value) for key, value in custom_limits.items() if value is not None})
    return limits


async def validate_operational_user(user: Dict[str, Any]) -> None:
    if user["role"] == "super_admin":
        return
    if user.get("organization_id"):
        org = await find_one_public("organizations", {"id": user["organization_id"]})
        if not org or org.get("status", "active") != "active" or not org.get("is_active", True):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Организация заблокирована или архивирована")
    if user.get("cleaning_company_id"):
        company = await find_one_public("cleaning_companies", {"id": user["cleaning_company_id"]})
        if not company or company.get("status", "active") != "active" or not company.get("is_active", True):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Клининговая компания заблокирована или архивирована")


async def ensure_org_assignment_limit(organization_id: str) -> None:
    org = await find_one_public("organizations", {"id": organization_id})
    if not org:
        raise HTTPException(status_code=404, detail="Организация не найдена")
    if org.get("status", "active") != "active":
        raise HTTPException(status_code=403, detail="Организация не активна")
    limits = org.get("limits", DEFAULT_ORG_LIMITS)
    max_monthly = limits.get("max_monthly_assignments", DEFAULT_ORG_LIMITS["max_monthly_assignments"])
    current_month = month_prefix()
    used = await db.assignments.count_documents({"organization_id": organization_id, "scheduled_date": {"$regex": f"^{current_month}"}})
    if used >= max_monthly:
        raise HTTPException(status_code=403, detail="Превышен месячный лимит задач организации")


async def ensure_company_operational(company: Dict[str, Any]) -> None:
    if company.get("status", "active") != "active" or not company.get("is_active", True):
        raise HTTPException(status_code=403, detail="Клининговая компания не активна")


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str = Field(min_length=4)
    name: str
    role: str
    organization_id: Optional[str] = None
    cleaning_company_id: Optional[str] = None


class OrganizationCreate(BaseModel):
    name: str
    inn: Optional[str] = None
    city: Optional[str] = None
    subscription_plan: str = "beta"
    limits: Optional[Dict[str, int]] = None
    notes: Optional[str] = None


class CleaningCompanyCreate(BaseModel):
    name: str
    type: str = "company"
    organization_ids: List[str] = Field(default_factory=list)
    subscription_plan: str = "beta"
    limits: Optional[Dict[str, int]] = None
    notes: Optional[str] = None


class BuildingCreate(BaseModel):
    name: str
    address: str
    type: str = "office"
    floors: int = 1
    total_area: float = 0
    organization_id: Optional[str] = None


class ZoneCreate(BaseModel):
    building_id: str
    name: str
    floor: int = 1
    type: str = "office"
    area: float = 0
    description: Optional[str] = None


class ChecklistItem(BaseModel):
    id: str = Field(default_factory=new_id)
    task: str
    required: bool = True


class ChecklistCreate(BaseModel):
    name: str
    zone_type: str = "office"
    items: List[ChecklistItem]
    organization_id: Optional[str] = None


class AssignmentCreate(BaseModel):
    zone_id: str
    checklist_id: str
    cleaning_company_id: str
    cleaner_user_id: Optional[str] = None
    title: str = "Плановая уборка"
    description: Optional[str] = None
    scheduled_date: str
    scheduled_time: str
    priority: str = "normal"


class AssignCleanerRequest(BaseModel):
    cleaner_user_id: str


class StatusUpdateRequest(BaseModel):
    status: str


class ReportItem(BaseModel):
    item_id: str
    task: str
    completed: bool
    comment: Optional[str] = None



class TenantStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


class PlanUpdate(BaseModel):
    subscription_plan: str
    limits: Optional[Dict[str, int]] = None
    notes: Optional[str] = None


class CompanyOrganizationLinksUpdate(BaseModel):
    organization_ids: List[str]
    reason: Optional[str] = None


class UserStatusUpdate(BaseModel):
    is_active: bool
    reason: Optional[str] = None


class ReportCreate(BaseModel):
    completed_items: List[ReportItem]
    final_notes: Optional[str] = None
    quality_score: int = Field(default=5, ge=1, le=5)
    photo_urls: List[str] = Field(default_factory=list)


@api_router.get("/")
async def root():
    return {"message": "SKYX Cleaning SaaS beta API", "roles": ROLES}


@api_router.post("/auth/login")
async def login(payload: LoginRequest):
    user = await db.users.find_one({"username": payload.username, "is_active": True})
    if not user or not pbkdf2_sha256.verify(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль")
    user = normalize_doc(user)
    await validate_operational_user(user)
    await audit_log(user, "auth.login", "user", user["id"], metadata={"username": user["username"]})
    return {"token": create_token(user), "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: Dict[str, Any] = Depends(get_current_user)):
    return public_user(user)


@api_router.post("/users")
async def create_user(payload: UserCreate, user: Dict[str, Any] = Depends(get_current_user)):
    if payload.role not in ROLES:
        raise HTTPException(status_code=400, detail="Недопустимая роль")

    existing = await db.users.find_one({"username": payload.username})
    if existing:
        raise HTTPException(status_code=409, detail="Логин уже занят")

    role = user["role"]
    organization_id = payload.organization_id
    cleaning_company_id = payload.cleaning_company_id

    if role == "super_admin":
        if payload.role == "organization_admin" and not organization_id:
            raise HTTPException(status_code=400, detail="organization_id обязателен для администратора организации")
        if payload.role in ["cleaning_company_admin", "cleaner"] and not cleaning_company_id:
            raise HTTPException(status_code=400, detail="cleaning_company_id обязателен для клининга/клинера")
    elif role == "organization_admin":
        require_roles(user, ["organization_admin"])
        if payload.role != "organization_admin":
            raise HTTPException(status_code=403, detail="Организация может создавать только своих администраторов")
        organization_id = user["organization_id"]
    elif role == "cleaning_company_admin":
        if payload.role != "cleaner":
            raise HTTPException(status_code=403, detail="Клининг может создавать только клинеров")
        cleaning_company_id = user["cleaning_company_id"]
    else:
        raise HTTPException(status_code=403, detail="Клинер не может создавать пользователей")

    doc = {
        "id": new_id(),
        "username": payload.username.strip(),
        "password_hash": pbkdf2_sha256.hash(payload.password),
        "role": payload.role,
        "name": payload.name,
        "organization_id": organization_id,
        "cleaning_company_id": cleaning_company_id,
        "is_active": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    await audit_log(user, "user.create", "user", doc["id"], after=public_user(doc), metadata={"created_role": payload.role})
    return public_user(doc)


@api_router.get("/users")
async def list_users(role: Optional[str] = None, user: Dict[str, Any] = Depends(get_current_user)):
    query: Dict[str, Any] = {"is_active": True}
    if role:
        query["role"] = role

    if user["role"] == "organization_admin":
        query["organization_id"] = user["organization_id"]
    elif user["role"] == "cleaning_company_admin":
        query["cleaning_company_id"] = user["cleaning_company_id"]
    elif user["role"] == "cleaner":
        query["id"] = user["id"]

    users = await find_many_public("users", query)
    return [public_user(item) for item in users]


@api_router.post("/organizations")
async def create_organization(payload: OrganizationCreate, user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin"])
    doc = payload.model_dump()
    doc["limits"] = merge_limits(doc.get("subscription_plan", "beta"), doc.get("limits"), DEFAULT_ORG_LIMITS)
    doc.update({"id": new_id(), "status": "active", "is_active": True, "created_at": now_iso(), "updated_at": now_iso()})
    await db.organizations.insert_one(doc)
    await audit_log(user, "organization.create", "organization", doc["id"], after=normalize_doc(dict(doc)))
    return normalize_doc(doc)


@api_router.get("/organizations")
async def list_organizations(user: Dict[str, Any] = Depends(get_current_user)):
    if user["role"] == "super_admin":
        return await find_many_public("organizations", {})
    if user.get("organization_id"):
        org = await find_one_public("organizations", {"id": user["organization_id"], "is_active": True})
        return [org] if org else []
    return []


@api_router.post("/cleaning-companies")
async def create_cleaning_company(payload: CleaningCompanyCreate, user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin"])
    doc = payload.model_dump()
    doc["limits"] = merge_limits(doc.get("subscription_plan", "beta"), doc.get("limits"), DEFAULT_COMPANY_LIMITS)
    doc.update({"id": new_id(), "status": "active", "is_active": True, "created_at": now_iso(), "updated_at": now_iso()})
    await db.cleaning_companies.insert_one(doc)
    await audit_log(user, "cleaning_company.create", "cleaning_company", doc["id"], after=normalize_doc(dict(doc)))
    return normalize_doc(doc)


@api_router.get("/cleaning-companies")
async def list_cleaning_companies(user: Dict[str, Any] = Depends(get_current_user)):
    role = user["role"]
    if role == "super_admin":
        query = {}
    elif role == "organization_admin":
        query = {"is_active": True, "organization_ids": user["organization_id"]}
    elif role in ["cleaning_company_admin", "cleaner"]:
        query = {"is_active": True, "id": user.get("cleaning_company_id")}
    else:
        query = {"id": "__no_access__"}
    return await find_many_public("cleaning_companies", query)


@api_router.post("/buildings")
async def create_building(payload: BuildingCreate, user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin", "organization_admin"])
    doc = payload.model_dump()
    if user["role"] == "organization_admin":
        doc["organization_id"] = user["organization_id"]
    if not doc.get("organization_id"):
        raise HTTPException(status_code=400, detail="organization_id обязателен")
    doc.update({"id": new_id(), "is_active": True, "created_at": now_iso()})
    await db.buildings.insert_one(doc)
    return normalize_doc(doc)


@api_router.get("/buildings")
async def list_buildings(user: Dict[str, Any] = Depends(get_current_user)):
    query = {"is_active": True}
    query.update(org_scope(user))
    if user["role"] in ["cleaning_company_admin", "cleaner"]:
        assignments = await find_many_public("assignments", assignment_scope(user))
        zone_ids = list({item["zone_id"] for item in assignments})
        zones = await find_many_public("zones", {"id": {"$in": zone_ids}}) if zone_ids else []
        building_ids = list({zone["building_id"] for zone in zones})
        query = {"is_active": True, "id": {"$in": building_ids}}
    return await find_many_public("buildings", query)


@api_router.post("/zones")
async def create_zone(payload: ZoneCreate, user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin", "organization_admin"])
    building = await find_one_public("buildings", {"id": payload.building_id, "is_active": True})
    if not building:
        raise HTTPException(status_code=404, detail="Объект не найден")
    assert_same_scope(building, org_scope(user))
    doc = payload.model_dump()
    doc.update({"id": new_id(), "organization_id": building["organization_id"], "is_active": True, "created_at": now_iso()})
    await db.zones.insert_one(doc)
    return normalize_doc(doc)


@api_router.get("/zones")
async def list_zones(user: Dict[str, Any] = Depends(get_current_user)):
    query = {"is_active": True}
    query.update(org_scope(user))
    if user["role"] in ["cleaning_company_admin", "cleaner"]:
        assignments = await find_many_public("assignments", assignment_scope(user))
        query = {"is_active": True, "id": {"$in": list({item["zone_id"] for item in assignments})}}
    return await find_many_public("zones", query)


@api_router.post("/checklists")
async def create_checklist(payload: ChecklistCreate, user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin", "organization_admin"])
    doc = payload.model_dump()
    if user["role"] == "organization_admin":
        doc["organization_id"] = user["organization_id"]
    if not doc.get("organization_id"):
        raise HTTPException(status_code=400, detail="organization_id обязателен")
    doc.update({"id": new_id(), "is_active": True, "created_at": now_iso()})
    await db.checklists.insert_one(doc)
    return normalize_doc(doc)


@api_router.get("/checklists")
async def list_checklists(user: Dict[str, Any] = Depends(get_current_user)):
    query = {"is_active": True}
    query.update(org_scope(user))
    if user["role"] in ["cleaning_company_admin", "cleaner"]:
        assignments = await find_many_public("assignments", assignment_scope(user))
        query = {"is_active": True, "id": {"$in": list({item["checklist_id"] for item in assignments})}}
    return await find_many_public("checklists", query)


async def enrich_assignment(assignment: Dict[str, Any]) -> Dict[str, Any]:
    enriched = dict(assignment)
    zone = await find_one_public("zones", {"id": assignment.get("zone_id")})
    building = await find_one_public("buildings", {"id": zone.get("building_id")}) if zone else None
    checklist = await find_one_public("checklists", {"id": assignment.get("checklist_id")})
    company = await find_one_public("cleaning_companies", {"id": assignment.get("cleaning_company_id")})
    cleaner = await find_one_public("users", {"id": assignment.get("cleaner_user_id")}) if assignment.get("cleaner_user_id") else None
    organization = await find_one_public("organizations", {"id": assignment.get("organization_id")})
    enriched.update({
        "zone_name": zone.get("name") if zone else "Зона удалена",
        "zone_type": zone.get("type") if zone else None,
        "building_name": building.get("name") if building else "Объект удален",
        "checklist_name": checklist.get("name") if checklist else "Чек-лист удален",
        "checklist_items": checklist.get("items", []) if checklist else [],
        "cleaning_company_name": company.get("name") if company else "Клининг удален",
        "cleaner_name": cleaner.get("name") if cleaner else "Не назначен",
        "organization_name": organization.get("name") if organization else "Организация удалена",
    })
    return enriched


@api_router.post("/assignments")
async def create_assignment(payload: AssignmentCreate, user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin", "organization_admin"])
    zone = await find_one_public("zones", {"id": payload.zone_id, "is_active": True})
    checklist = await find_one_public("checklists", {"id": payload.checklist_id, "is_active": True})
    company = await find_one_public("cleaning_companies", {"id": payload.cleaning_company_id, "is_active": True})
    if not zone or not checklist or not company:
        raise HTTPException(status_code=404, detail="Зона, чек-лист или клининговая компания не найдены")
    await ensure_company_operational(company)
    await ensure_org_assignment_limit(zone["organization_id"])
    assert_same_scope(zone, org_scope(user))
    assert_same_scope(checklist, {"organization_id": zone["organization_id"]})
    if zone["organization_id"] not in company.get("organization_ids", []):
        raise HTTPException(status_code=403, detail="Клининговая компания не привязана к организации")

    cleaner_user_id = payload.cleaner_user_id
    if cleaner_user_id:
        cleaner = await find_one_public("users", {"id": cleaner_user_id, "role": "cleaner", "cleaning_company_id": company["id"], "is_active": True})
        if not cleaner:
            raise HTTPException(status_code=400, detail="Клинер не найден в выбранной компании")

    doc = payload.model_dump()
    doc.update({
        "id": new_id(),
        "organization_id": zone["organization_id"],
        "status": "assigned" if cleaner_user_id else "pending",
        "report": None,
        "created_by_user_id": user["id"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await db.assignments.insert_one(doc)
    await audit_log(user, "assignment.create", "assignment", doc["id"], after=normalize_doc(dict(doc)), metadata={"organization_id": doc["organization_id"], "cleaning_company_id": doc["cleaning_company_id"]})
    return await enrich_assignment(normalize_doc(doc))


@api_router.get("/assignments")
async def list_assignments(user: Dict[str, Any] = Depends(get_current_user)):
    query = assignment_scope(user)
    docs = await find_many_public("assignments", query)
    return [await enrich_assignment(doc) for doc in docs]


@api_router.patch("/assignments/{assignment_id}/assign-cleaner")
async def assign_cleaner(assignment_id: str, payload: AssignCleanerRequest, user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin", "cleaning_company_admin"])
    assignment = await find_one_public("assignments", {"id": assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    assert_same_scope(assignment, company_scope(user))
    cleaner = await find_one_public("users", {"id": payload.cleaner_user_id, "role": "cleaner", "cleaning_company_id": assignment["cleaning_company_id"], "is_active": True})
    if not cleaner:
        raise HTTPException(status_code=400, detail="Клинер не найден в вашей компании")
    await db.assignments.update_one({"id": assignment_id}, {"$set": {"cleaner_user_id": payload.cleaner_user_id, "status": "assigned", "updated_at": now_iso()}})
    await audit_log(user, "assignment.assign_cleaner", "assignment", assignment_id, before=assignment, after={"cleaner_user_id": payload.cleaner_user_id, "status": "assigned"})
    updated = await find_one_public("assignments", {"id": assignment_id})
    return await enrich_assignment(updated)


@api_router.patch("/assignments/{assignment_id}/status")
async def update_assignment_status(assignment_id: str, payload: StatusUpdateRequest, user: Dict[str, Any] = Depends(get_current_user)):
    if payload.status not in ["pending", "assigned", "in_progress", "completed", "rejected"]:
        raise HTTPException(status_code=400, detail="Недопустимый статус")
    assignment = await find_one_public("assignments", {"id": assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    assert_same_scope(assignment, assignment_scope(user))
    if user["role"] == "cleaner" and payload.status not in ["in_progress"]:
        raise HTTPException(status_code=403, detail="Клинер может только начать задачу, завершение идет через отчет")
    await db.assignments.update_one({"id": assignment_id}, {"$set": {"status": payload.status, "updated_at": now_iso()}})
    await audit_log(user, "assignment.status_update", "assignment", assignment_id, before={"status": assignment.get("status")}, after={"status": payload.status})
    updated = await find_one_public("assignments", {"id": assignment_id})
    return await enrich_assignment(updated)


@api_router.post("/assignments/{assignment_id}/report")
async def submit_report(assignment_id: str, payload: ReportCreate, user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["cleaner", "cleaning_company_admin", "super_admin"])
    assignment = await find_one_public("assignments", {"id": assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    assert_same_scope(assignment, assignment_scope(user))
    report = payload.model_dump()
    report.update({"submitted_by_user_id": user["id"], "submitted_at": now_iso()})
    await db.assignments.update_one(
        {"id": assignment_id},
        {"$set": {"report": report, "status": "completed", "completed_at": now_iso(), "updated_at": now_iso()}},
    )
    await audit_log(user, "assignment.report_submit", "assignment", assignment_id, before={"status": assignment.get("status")}, after={"status": "completed", "quality_score": report.get("quality_score")})
    updated = await find_one_public("assignments", {"id": assignment_id})
    return await enrich_assignment(updated)



async def tenant_usage_snapshot(organization: Dict[str, Any]) -> Dict[str, Any]:
    org_id = organization["id"]
    assignments = await find_many_public("assignments", {"organization_id": org_id}, limit=5000)
    completed = len([item for item in assignments if item.get("status") == "completed"])
    overdue = len([
        item for item in assignments
        if item.get("scheduled_date", datetime.now(timezone.utc).date().isoformat()) < datetime.now(timezone.utc).date().isoformat()
        and item.get("status") != "completed"
    ])
    linked_companies = await find_many_public("cleaning_companies", {"organization_ids": org_id}, limit=500)
    buildings_count = await db.buildings.count_documents({"organization_id": org_id, "is_active": True})
    zones_count = await db.zones.count_documents({"organization_id": org_id, "is_active": True})
    reports = [item.get("report") for item in assignments if item.get("report")]
    average_quality = round(sum(report.get("quality_score", 0) for report in reports) / len(reports), 2) if reports else 0
    limits = organization.get("limits", DEFAULT_ORG_LIMITS)
    usage = {
        "buildings": buildings_count,
        "zones": zones_count,
        "assignments_total": len(assignments),
        "completed": completed,
        "overdue": overdue,
        "linked_companies": len(linked_companies),
        "average_quality": average_quality,
        "completion_rate": round((completed / len(assignments)) * 100, 1) if assignments else 0,
    }
    risks = []
    if organization.get("status", "active") != "active":
        risks.append("tenant_not_active")
    if overdue > 0:
        risks.append("overdue_tasks")
    if average_quality and average_quality < 4:
        risks.append("low_quality")
    if limits.get("max_buildings") and buildings_count >= limits.get("max_buildings") * 0.8:
        risks.append("building_limit_near")
    if limits.get("max_monthly_assignments") and len(assignments) >= limits.get("max_monthly_assignments") * 0.8:
        risks.append("assignment_limit_near")
    return {"organization": organization, "usage": usage, "risks": risks}


async def company_usage_snapshot(company: Dict[str, Any]) -> Dict[str, Any]:
    company_id = company["id"]
    assignments = await find_many_public("assignments", {"cleaning_company_id": company_id}, limit=5000)
    cleaners = await find_many_public("users", {"cleaning_company_id": company_id, "role": "cleaner"}, limit=1000)
    completed = len([item for item in assignments if item.get("status") == "completed"])
    reports = [item.get("report") for item in assignments if item.get("report")]
    average_quality = round(sum(report.get("quality_score", 0) for report in reports) / len(reports), 2) if reports else 0
    risks = []
    if company.get("status", "active") != "active":
        risks.append("company_not_active")
    if average_quality and average_quality < 4:
        risks.append("low_quality")
    if len([item for item in assignments if item.get("status") in ["pending", "assigned"]]) > max(5, len(cleaners) * 3):
        risks.append("assignment_backlog")
    return {
        "company": company,
        "usage": {
            "cleaners": len(cleaners),
            "assignments_total": len(assignments),
            "completed": completed,
            "completion_rate": round((completed / len(assignments)) * 100, 1) if assignments else 0,
            "average_quality": average_quality,
            "linked_organizations": len(company.get("organization_ids", [])),
        },
        "risks": risks,
    }


@api_router.get("/super-admin/command-center")
async def super_admin_command_center(user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin"])
    organizations = await find_many_public("organizations", {}, limit=5000)
    companies = await find_many_public("cleaning_companies", {}, limit=5000)
    users = await find_many_public("users", {}, limit=10000)
    assignments = await find_many_public("assignments", {}, limit=10000)
    reports = [item.get("report") for item in assignments if item.get("report")]
    today = datetime.now(timezone.utc).date().isoformat()
    overdue = len([item for item in assignments if item.get("scheduled_date", today) < today and item.get("status") != "completed"])
    completed = len([item for item in assignments if item.get("status") == "completed"])
    org_matrix = [await tenant_usage_snapshot(item) for item in organizations]
    company_matrix = [await company_usage_snapshot(item) for item in companies]
    recent_audit = await find_many_public("audit_logs", {}, limit=30)
    risk_count = len([item for item in org_matrix + company_matrix if item.get("risks")])
    health_score = max(0, 100 - (overdue * 3) - (risk_count * 8))
    return {
        "platform": {
            "health_score": health_score,
            "organizations_total": len(organizations),
            "organizations_active": len([item for item in organizations if item.get("status", "active") == "active"]),
            "organizations_suspended": len([item for item in organizations if item.get("status") == "suspended"]),
            "cleaning_companies_total": len(companies),
            "companies_active": len([item for item in companies if item.get("status", "active") == "active"]),
            "users_total": len(users),
            "active_users": len([item for item in users if item.get("is_active", True)]),
            "assignments_total": len(assignments),
            "completed": completed,
            "overdue": overdue,
            "completion_rate": round((completed / len(assignments)) * 100, 1) if assignments else 0,
            "average_quality": round(sum(report.get("quality_score", 0) for report in reports) / len(reports), 2) if reports else 0,
            "risk_tenants": risk_count,
        },
        "organizations": org_matrix,
        "cleaning_companies": company_matrix,
        "recent_audit": recent_audit,
        "plan_presets": PLAN_PRESETS,
    }


@api_router.get("/super-admin/audit-log")
async def list_audit_logs(user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin"])
    return await find_many_public("audit_logs", {}, limit=200)


@api_router.patch("/super-admin/organizations/{organization_id}/status")
async def update_organization_status(organization_id: str, payload: TenantStatusUpdate, user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin"])
    if payload.status not in TENANT_STATUSES:
        raise HTTPException(status_code=400, detail="Недопустимый статус tenant-а")
    org = await find_one_public("organizations", {"id": organization_id})
    if not org:
        raise HTTPException(status_code=404, detail="Организация не найдена")
    patch = {"status": payload.status, "is_active": payload.status != "archived", "updated_at": now_iso()}
    await db.organizations.update_one({"id": organization_id}, {"$set": patch})
    updated = await find_one_public("organizations", {"id": organization_id})
    await audit_log(user, "organization.status_update", "organization", organization_id, before=org, after=updated, metadata={"reason": payload.reason})
    return updated


@api_router.patch("/super-admin/organizations/{organization_id}/plan")
async def update_organization_plan(organization_id: str, payload: PlanUpdate, user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin"])
    org = await find_one_public("organizations", {"id": organization_id})
    if not org:
        raise HTTPException(status_code=404, detail="Организация не найдена")
    patch = {
        "subscription_plan": payload.subscription_plan,
        "limits": merge_limits(payload.subscription_plan, payload.limits, DEFAULT_ORG_LIMITS),
        "updated_at": now_iso(),
    }
    if payload.notes:
        patch["notes"] = payload.notes
    await db.organizations.update_one({"id": organization_id}, {"$set": patch})
    updated = await find_one_public("organizations", {"id": organization_id})
    await audit_log(user, "organization.plan_update", "organization", organization_id, before=org, after=updated)
    return updated


@api_router.patch("/super-admin/cleaning-companies/{company_id}/status")
async def update_cleaning_company_status(company_id: str, payload: TenantStatusUpdate, user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin"])
    if payload.status not in TENANT_STATUSES:
        raise HTTPException(status_code=400, detail="Недопустимый статус tenant-а")
    company = await find_one_public("cleaning_companies", {"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Клининговая компания не найдена")
    patch = {"status": payload.status, "is_active": payload.status != "archived", "updated_at": now_iso()}
    await db.cleaning_companies.update_one({"id": company_id}, {"$set": patch})
    updated = await find_one_public("cleaning_companies", {"id": company_id})
    await audit_log(user, "cleaning_company.status_update", "cleaning_company", company_id, before=company, after=updated, metadata={"reason": payload.reason})
    return updated


@api_router.patch("/super-admin/cleaning-companies/{company_id}/plan")
async def update_cleaning_company_plan(company_id: str, payload: PlanUpdate, user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin"])
    company = await find_one_public("cleaning_companies", {"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Клининговая компания не найдена")
    patch = {
        "subscription_plan": payload.subscription_plan,
        "limits": merge_limits(payload.subscription_plan, payload.limits, DEFAULT_COMPANY_LIMITS),
        "updated_at": now_iso(),
    }
    if payload.notes:
        patch["notes"] = payload.notes
    await db.cleaning_companies.update_one({"id": company_id}, {"$set": patch})
    updated = await find_one_public("cleaning_companies", {"id": company_id})
    await audit_log(user, "cleaning_company.plan_update", "cleaning_company", company_id, before=company, after=updated)
    return updated


@api_router.patch("/super-admin/cleaning-companies/{company_id}/organizations")
async def update_company_organization_links(company_id: str, payload: CompanyOrganizationLinksUpdate, user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin"])
    company = await find_one_public("cleaning_companies", {"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Клининговая компания не найдена")
    if payload.organization_ids:
        found = await find_many_public("organizations", {"id": {"$in": payload.organization_ids}}, limit=1000)
        if len(found) != len(set(payload.organization_ids)):
            raise HTTPException(status_code=400, detail="Одна или несколько организаций не найдены")
    await db.cleaning_companies.update_one({"id": company_id}, {"$set": {"organization_ids": payload.organization_ids, "updated_at": now_iso()}})
    updated = await find_one_public("cleaning_companies", {"id": company_id})
    await audit_log(user, "cleaning_company.organization_links_update", "cleaning_company", company_id, before=company, after=updated, metadata={"reason": payload.reason})
    return updated


@api_router.patch("/super-admin/users/{user_id}/status")
async def update_user_status(user_id: str, payload: UserStatusUpdate, user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin"])
    target = await find_one_public("users", {"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if target.get("role") == "super_admin" and target.get("id") == user.get("id") and not payload.is_active:
        raise HTTPException(status_code=400, detail="Нельзя заблокировать текущего супер-админа")
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": payload.is_active, "updated_at": now_iso()}})
    updated = await find_one_public("users", {"id": user_id})
    await audit_log(user, "user.status_update", "user", user_id, before=target, after=public_user(updated), metadata={"reason": payload.reason})
    return public_user(updated)


@api_router.get("/analytics/overview")
async def analytics_overview(user: Dict[str, Any] = Depends(get_current_user)):
    assignments = await find_many_public("assignments", assignment_scope(user), limit=5000)
    users_query: Dict[str, Any] = {"is_active": True}
    if user["role"] == "organization_admin":
        users_query["organization_id"] = user["organization_id"]
    elif user["role"] in ["cleaning_company_admin", "cleaner"]:
        users_query["cleaning_company_id"] = user.get("cleaning_company_id")
    users = await find_many_public("users", users_query, limit=5000)

    total = len(assignments)
    completed = len([item for item in assignments if item.get("status") == "completed"])
    pending = len([item for item in assignments if item.get("status") == "pending"])
    assigned = len([item for item in assignments if item.get("status") == "assigned"])
    in_progress = len([item for item in assignments if item.get("status") == "in_progress"])
    reports = [item.get("report") for item in assignments if item.get("report")]
    average_quality = round(sum(report.get("quality_score", 0) for report in reports) / len(reports), 2) if reports else 0
    today = datetime.now(timezone.utc).date().isoformat()
    overdue = len([item for item in assignments if item.get("scheduled_date", today) < today and item.get("status") != "completed"])

    response = {
        "assignments_total": total,
        "completed": completed,
        "pending": pending,
        "assigned": assigned,
        "in_progress": in_progress,
        "completion_rate": round((completed / total) * 100, 1) if total else 0,
        "overdue": overdue,
        "reports_total": len(reports),
        "average_quality": average_quality,
        "active_cleaners": len([item for item in users if item.get("role") == "cleaner"]),
    }
    if user["role"] == "super_admin":
        response["organizations"] = await db.organizations.count_documents({"is_active": True})
        response["cleaning_companies"] = await db.cleaning_companies.count_documents({"is_active": True})
    return response


async def seed_demo_data() -> None:
    await db.users.create_index("username", unique=True)
    await db.organizations.create_index("id", unique=True)
    await db.cleaning_companies.create_index("id", unique=True)
    await db.buildings.create_index("id", unique=True)
    await db.zones.create_index("id", unique=True)
    await db.checklists.create_index("id", unique=True)
    await db.assignments.create_index("id", unique=True)
    await db.audit_logs.create_index("id", unique=True)
    await db.audit_logs.create_index("created_at")

    await db.organizations.update_many(
        {"status": {"$exists": False}},
        {"$set": {"status": "active", "subscription_plan": "beta", "limits": merge_limits("beta", None, DEFAULT_ORG_LIMITS), "updated_at": now_iso()}},
    )
    await db.cleaning_companies.update_many(
        {"status": {"$exists": False}},
        {"$set": {"status": "active", "subscription_plan": "beta", "limits": merge_limits("beta", None, DEFAULT_COMPANY_LIMITS), "updated_at": now_iso()}},
    )
    await db.users.update_many({"is_active": {"$exists": False}}, {"$set": {"is_active": True}})

    if not await db.users.find_one({"username": "superadmin"}):
        org_id = new_id()
        company_id = new_id()
        building_id = new_id()
        zone_id = new_id()
        checklist_id = new_id()
        cleaner_id = new_id()

        await db.organizations.insert_one({
            "id": org_id,
            "name": "Газпром демо",
            "inn": "0000000000",
            "city": "Москва",
            "notes": "Демо-организация для beta",
            "status": "active",
            "subscription_plan": "enterprise",
            "limits": merge_limits("enterprise", None, DEFAULT_ORG_LIMITS),
            "is_active": True,
            "created_at": now_iso(),
        })
        await db.cleaning_companies.insert_one({
            "id": company_id,
            "name": "ЧистоСервис демо",
            "type": "company",
            "organization_ids": [org_id],
            "notes": "Демо-клининг, привязан к Газпром демо",
            "status": "active",
            "subscription_plan": "growth",
            "limits": merge_limits("growth", None, DEFAULT_COMPANY_LIMITS),
            "is_active": True,
            "created_at": now_iso(),
        })
        users = [
            {"username": "superadmin", "password": "Super2025!", "role": "super_admin", "name": "Супер-админ SKYX", "organization_id": None, "cleaning_company_id": None},
            {"username": "org_gazprom", "password": "Org2025!", "role": "organization_admin", "name": "Админ Газпром", "organization_id": org_id, "cleaning_company_id": None},
            {"username": "cleaning_admin", "password": "Clean2025!", "role": "cleaning_company_admin", "name": "Админ ЧистоСервис", "organization_id": None, "cleaning_company_id": company_id},
            {"username": "cleaner_maria", "password": "Cleaner2025!", "role": "cleaner", "name": "Мария Клинер", "organization_id": None, "cleaning_company_id": company_id, "id": cleaner_id},
        ]
        for item in users:
            doc = {
                "id": item.get("id", new_id()),
                "username": item["username"],
                "password_hash": pbkdf2_sha256.hash(item["password"]),
                "role": item["role"],
                "name": item["name"],
                "organization_id": item["organization_id"],
                "cleaning_company_id": item["cleaning_company_id"],
                "is_active": True,
                "created_at": now_iso(),
            }
            await db.users.insert_one(doc)

        await db.buildings.insert_one({
            "id": building_id,
            "organization_id": org_id,
            "name": "Бизнес-центр Газпром",
            "address": "Москва, демо-адрес, 1",
            "type": "office",
            "floors": 12,
            "total_area": 15000,
            "is_active": True,
            "created_at": now_iso(),
        })
        await db.zones.insert_one({
            "id": zone_id,
            "organization_id": org_id,
            "building_id": building_id,
            "name": "Лобби 1 этаж",
            "floor": 1,
            "type": "public_area",
            "area": 240,
            "description": "Входная группа и ресепшен",
            "is_active": True,
            "created_at": now_iso(),
        })
        await db.checklists.insert_one({
            "id": checklist_id,
            "organization_id": org_id,
            "name": "Ежедневная уборка лобби",
            "zone_type": "public_area",
            "items": [
                {"id": new_id(), "task": "Вымыть пол", "required": True},
                {"id": new_id(), "task": "Протереть стойку ресепшен", "required": True},
                {"id": new_id(), "task": "Проверить урны", "required": True},
            ],
            "is_active": True,
            "created_at": now_iso(),
        })
        await db.assignments.insert_one({
            "id": new_id(),
            "organization_id": org_id,
            "zone_id": zone_id,
            "checklist_id": checklist_id,
            "cleaning_company_id": company_id,
            "cleaner_user_id": cleaner_id,
            "title": "Утренний клининг лобби",
            "description": "Проверить чистоту входной группы до начала рабочего дня",
            "scheduled_date": datetime.now(timezone.utc).date().isoformat(),
            "scheduled_time": "09:00",
            "priority": "high",
            "status": "assigned",
            "report": None,
            "created_by_user_id": None,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_event():
    await seed_demo_data()
    logger.info("SKYX beta seed and indexes ready")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
