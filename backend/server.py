from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')

# Payment Plans
SUBSCRIPTION_PRICE = 4.99  # Monthly subscription for transporters
COMMISSION_RATE = 0.10  # 10% commission on transactions

security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============ MODELS ============

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    nombre: str
    telefono: str
    roles: List[str]  # ["cliente", "transportista"]

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    nombre: str
    telefono: str
    roles: List[str]
    rating: float = 0.0
    num_ratings: int = 0
    created_at: str

class TransportRequestCreate(BaseModel):
    titulo: str
    descripcion: str
    origen: str
    destino: str
    tipo_carga: str
    precio_ofrecido: float

class TransportRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    cliente_id: str
    cliente_nombre: str
    titulo: str
    descripcion: str
    origen: str
    destino: str
    tipo_carga: str
    precio_ofrecido: float
    estado: str  # abierto, en_negociacion, aceptado, en_transito, completado, cancelado
    created_at: str

class OfferCreate(BaseModel):
    solicitud_id: str
    precio_oferta: float
    mensaje: Optional[str] = ""
    tipo: str = "oferta"  # oferta, contraoferta

class Offer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    solicitud_id: str
    transportista_id: str
    transportista_nombre: str
    precio_oferta: float
    mensaje: str
    estado: str  # pendiente, aceptada, rechazada
    tipo: str
    created_at: str

class RatingCreate(BaseModel):
    to_user_id: str
    solicitud_id: str
    rating: int  # 1-5
    comentario: Optional[str] = ""

class Rating(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    from_user_id: str
    from_user_nombre: str
    to_user_id: str
    solicitud_id: str
    rating: int
    comentario: str
    created_at: str

# ============ PAYMENT MODELS ============

class SubscriptionRequest(BaseModel):
    origin_url: str

class CommissionPaymentRequest(BaseModel):
    origin_url: str
    solicitud_id: str

class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_email: str
    session_id: str
    amount: float
    currency: str
    payment_type: str  # subscription, commission
    payment_method: str  # stripe, paypal
    status: str  # pending, paid, failed, expired
    metadata: Dict[str, str]
    created_at: str
    updated_at: str

# ============ AUTH UTILITIES ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Token inválido")

# ============ AUTH ROUTES ============

@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    # Validate roles
    valid_roles = ["cliente", "transportista"]
    for role in user_data.roles:
        if role not in valid_roles:
            raise HTTPException(status_code=400, detail=f"Rol inválido: {role}")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "nombre": user_data.nombre,
        "telefono": user_data.telefono,
        "roles": user_data.roles,
        "rating": 0.0,
        "num_ratings": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id)
    user_response = {k: v for k, v in user_doc.items() if k not in ["password_hash", "_id"]}
    
    return {
        "token": token,
        "user": user_response
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    token = create_token(user["id"])
    user_response = {k: v for k, v in user.items() if k not in ["password_hash", "_id"]}
    
    return {
        "token": token,
        "user": user_response
    }

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ============ TRANSPORT REQUEST ROUTES ============

@api_router.post("/requests", response_model=TransportRequest)
async def create_request(request_data: TransportRequestCreate, current_user: User = Depends(get_current_user)):
    if "cliente" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Solo los clientes pueden crear solicitudes")
    
    request_id = str(uuid.uuid4())
    request_doc = {
        "id": request_id,
        "cliente_id": current_user.id,
        "cliente_nombre": current_user.nombre,
        "titulo": request_data.titulo,
        "descripcion": request_data.descripcion,
        "origen": request_data.origen,
        "destino": request_data.destino,
        "tipo_carga": request_data.tipo_carga,
        "precio_ofrecido": request_data.precio_ofrecido,
        "estado": "abierto",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.transport_requests.insert_one(request_doc)
    return TransportRequest(**{k: v for k, v in request_doc.items() if k != "_id"})

@api_router.get("/requests", response_model=List[TransportRequest])
async def get_requests(estado: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if estado:
        query["estado"] = estado
    
    requests = await db.transport_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return requests

@api_router.get("/requests/my-requests", response_model=List[TransportRequest])
async def get_my_requests(current_user: User = Depends(get_current_user)):
    requests = await db.transport_requests.find(
        {"cliente_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return requests

@api_router.get("/requests/{request_id}", response_model=TransportRequest)
async def get_request(request_id: str, current_user: User = Depends(get_current_user)):
    request = await db.transport_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return TransportRequest(**request)

@api_router.patch("/requests/{request_id}")
async def update_request_status(request_id: str, estado: str, current_user: User = Depends(get_current_user)):
    request = await db.transport_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    
    # Validate permissions
    if request["cliente_id"] != current_user.id:
        # Check if user is the accepted transporter
        accepted_offer = await db.offers.find_one({
            "solicitud_id": request_id,
            "estado": "aceptada",
            "transportista_id": current_user.id
        })
        if not accepted_offer:
            raise HTTPException(status_code=403, detail="No tienes permiso para actualizar esta solicitud")
    
    await db.transport_requests.update_one(
        {"id": request_id},
        {"$set": {"estado": estado}}
    )
    
    return {"message": "Estado actualizado", "estado": estado}

@api_router.delete("/requests/{request_id}")
async def delete_request(request_id: str, current_user: User = Depends(get_current_user)):
    request = await db.transport_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    
    if request["cliente_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar esta solicitud")
    
    await db.transport_requests.update_one(
        {"id": request_id},
        {"$set": {"estado": "cancelado"}}
    )
    
    return {"message": "Solicitud cancelada"}

# ============ OFFER ROUTES ============

@api_router.post("/offers", response_model=Offer)
async def create_offer(offer_data: OfferCreate, current_user: User = Depends(get_current_user)):
    if "transportista" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Solo los transportistas pueden hacer ofertas")
    
    # Check if request exists
    request = await db.transport_requests.find_one({"id": offer_data.solicitud_id})
    if not request:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    
    # Check if request is still open
    if request["estado"] not in ["abierto", "en_negociacion"]:
        raise HTTPException(status_code=400, detail="La solicitud no está disponible para ofertas")
    
    offer_id = str(uuid.uuid4())
    offer_doc = {
        "id": offer_id,
        "solicitud_id": offer_data.solicitud_id,
        "transportista_id": current_user.id,
        "transportista_nombre": current_user.nombre,
        "precio_oferta": offer_data.precio_oferta,
        "mensaje": offer_data.mensaje,
        "estado": "pendiente",
        "tipo": offer_data.tipo,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.offers.insert_one(offer_doc)
    
    # Update request status to en_negociacion
    await db.transport_requests.update_one(
        {"id": offer_data.solicitud_id},
        {"$set": {"estado": "en_negociacion"}}
    )
    
    return Offer(**{k: v for k, v in offer_doc.items() if k != "_id"})

@api_router.get("/offers/request/{request_id}", response_model=List[Offer])
async def get_offers_for_request(request_id: str, current_user: User = Depends(get_current_user)):
    offers = await db.offers.find(
        {"solicitud_id": request_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return offers

@api_router.get("/offers/my-offers", response_model=List[Offer])
async def get_my_offers(current_user: User = Depends(get_current_user)):
    offers = await db.offers.find(
        {"transportista_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return offers

@api_router.patch("/offers/{offer_id}/accept")
async def accept_offer(offer_id: str, current_user: User = Depends(get_current_user)):
    offer = await db.offers.find_one({"id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    
    # Check if user is the client
    request = await db.transport_requests.find_one({"id": offer["solicitud_id"]})
    if request["cliente_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el cliente puede aceptar ofertas")
    
    # Reject all other offers
    await db.offers.update_many(
        {"solicitud_id": offer["solicitud_id"], "id": {"$ne": offer_id}},
        {"$set": {"estado": "rechazada"}}
    )
    
    # Accept this offer
    await db.offers.update_one(
        {"id": offer_id},
        {"$set": {"estado": "aceptada"}}
    )
    
    # Update request status
    await db.transport_requests.update_one(
        {"id": offer["solicitud_id"]},
        {"$set": {"estado": "aceptado"}}
    )
    
    # Create transaction record (simulated)
    transaction_doc = {
        "id": str(uuid.uuid4()),
        "solicitud_id": offer["solicitud_id"],
        "monto": offer["precio_oferta"],
        "comision": offer["precio_oferta"] * 0.10,  # 10% commission
        "tipo": "comision",
        "estado": "simulado",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(transaction_doc)
    
    return {"message": "Oferta aceptada"}

@api_router.patch("/offers/{offer_id}/reject")
async def reject_offer(offer_id: str, current_user: User = Depends(get_current_user)):
    offer = await db.offers.find_one({"id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    
    # Check if user is the client
    request = await db.transport_requests.find_one({"id": offer["solicitud_id"]})
    if request["cliente_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el cliente puede rechazar ofertas")
    
    await db.offers.update_one(
        {"id": offer_id},
        {"$set": {"estado": "rechazada"}}
    )
    
    return {"message": "Oferta rechazada"}

# ============ RATING ROUTES ============

@api_router.post("/ratings", response_model=Rating)
async def create_rating(rating_data: RatingCreate, current_user: User = Depends(get_current_user)):
    # Check if rating already exists
    existing = await db.ratings.find_one({
        "from_user_id": current_user.id,
        "solicitud_id": rating_data.solicitud_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya has calificado esta transacción")
    
    # Validate rating
    if rating_data.rating < 1 or rating_data.rating > 5:
        raise HTTPException(status_code=400, detail="La calificación debe ser entre 1 y 5")
    
    rating_id = str(uuid.uuid4())
    rating_doc = {
        "id": rating_id,
        "from_user_id": current_user.id,
        "from_user_nombre": current_user.nombre,
        "to_user_id": rating_data.to_user_id,
        "solicitud_id": rating_data.solicitud_id,
        "rating": rating_data.rating,
        "comentario": rating_data.comentario,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ratings.insert_one(rating_doc)
    
    # Update user's average rating
    all_ratings = await db.ratings.find({"to_user_id": rating_data.to_user_id}).to_list(1000)
    avg_rating = sum(r["rating"] for r in all_ratings) / len(all_ratings)
    
    await db.users.update_one(
        {"id": rating_data.to_user_id},
        {"$set": {"rating": round(avg_rating, 2), "num_ratings": len(all_ratings)}}
    )
    
    return Rating(**{k: v for k, v in rating_doc.items() if k != "_id"})

@api_router.get("/ratings/user/{user_id}", response_model=List[Rating])
async def get_user_ratings(user_id: str):
    ratings = await db.ratings.find(
        {"to_user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return ratings

# ============ DASHBOARD ROUTES ============

@api_router.get("/dashboard/stats")
async def get_stats(current_user: User = Depends(get_current_user)):
    stats = {}
    
    if "cliente" in current_user.roles:
        total_requests = await db.transport_requests.count_documents({"cliente_id": current_user.id})
        active_requests = await db.transport_requests.count_documents({
            "cliente_id": current_user.id,
            "estado": {"$in": ["abierto", "en_negociacion", "aceptado", "en_transito"]}
        })
        completed_requests = await db.transport_requests.count_documents({
            "cliente_id": current_user.id,
            "estado": "completado"
        })
        stats["cliente"] = {
            "total_solicitudes": total_requests,
            "solicitudes_activas": active_requests,
            "solicitudes_completadas": completed_requests
        }
    
    if "transportista" in current_user.roles:
        total_offers = await db.offers.count_documents({"transportista_id": current_user.id})
        accepted_offers = await db.offers.count_documents({
            "transportista_id": current_user.id,
            "estado": "aceptada"
        })
        pending_offers = await db.offers.count_documents({
            "transportista_id": current_user.id,
            "estado": "pendiente"
        })
        stats["transportista"] = {
            "total_ofertas": total_offers,
            "ofertas_aceptadas": accepted_offers,
            "ofertas_pendientes": pending_offers
        }
    
    return stats

# Health check endpoint for Kubernetes
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
