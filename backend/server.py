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
    return normalize_doc(user)


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
    notes: Optional[str] = None


class CleaningCompanyCreate(BaseModel):
    name: str
    type: str = "company"
    organization_ids: List[str] = Field(default_factory=list)
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
    doc.update({"id": new_id(), "is_active": True, "created_at": now_iso()})
    await db.organizations.insert_one(doc)
    return normalize_doc(doc)


@api_router.get("/organizations")
async def list_organizations(user: Dict[str, Any] = Depends(get_current_user)):
    if user["role"] == "super_admin":
        return await find_many_public("organizations", {"is_active": True})
    if user.get("organization_id"):
        org = await find_one_public("organizations", {"id": user["organization_id"], "is_active": True})
        return [org] if org else []
    return []


@api_router.post("/cleaning-companies")
async def create_cleaning_company(payload: CleaningCompanyCreate, user: Dict[str, Any] = Depends(get_current_user)):
    require_roles(user, ["super_admin"])
    doc = payload.model_dump()
    doc.update({"id": new_id(), "is_active": True, "created_at": now_iso()})
    await db.cleaning_companies.insert_one(doc)
    return normalize_doc(doc)


@api_router.get("/cleaning-companies")
async def list_cleaning_companies(user: Dict[str, Any] = Depends(get_current_user)):
    role = user["role"]
    if role == "super_admin":
        query = {"is_active": True}
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
    updated = await find_one_public("assignments", {"id": assignment_id})
    return await enrich_assignment(updated)


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
            "is_active": True,
            "created_at": now_iso(),
        })
        await db.cleaning_companies.insert_one({
            "id": company_id,
            "name": "ЧистоСервис демо",
            "type": "company",
            "organization_ids": [org_id],
            "notes": "Демо-клининг, привязан к Газпром демо",
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
