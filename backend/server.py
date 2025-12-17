from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import base64
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

security = HTTPBearer(auto_error=False)

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
    roles: List[str]  # ["cliente", "transportista", "admin"]

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

# Admin check dependency
async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    if "admin" not in user.roles:
        raise HTTPException(status_code=403, detail="Se requiere rol de administrador")
    return user

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

# ============ CHAT MODELS ============

class MessageCreate(BaseModel):
    solicitud_id: str
    contenido: str

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    solicitud_id: str
    sender_id: str
    sender_nombre: str
    receiver_id: str
    contenido: str
    contenido_original: Optional[str] = None
    bloqueado: bool = False
    razon_bloqueo: Optional[str] = None
    leido: bool = False
    created_at: str

# ============ VERIFICATION MODELS ============

class IdentityVerification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    tipo_documento: str  # dni, pasaporte, etc
    numero_documento: str
    documento_imagen: str  # base64
    selfie_imagen: Optional[str] = None
    status: str  # pending, approved, rejected
    admin_notes: Optional[str] = None
    created_at: str
    updated_at: str

class VehicleVerification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    tipo_vehiculo: str  # furgoneta, camion, coche, moto
    marca: str
    modelo: str
    ano: int
    matricula: str
    foto_vehiculo: str  # base64
    foto_matricula: str  # base64
    permiso_circulacion: Optional[str] = None  # base64
    seguro_imagen: Optional[str] = None  # base64
    status: str  # pending, approved, rejected
    admin_notes: Optional[str] = None
    created_at: str
    updated_at: str

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    tipo: str  # message, offer, verification, payment
    titulo: str
    mensaje: str
    link: Optional[str] = None
    leida: bool = False
    created_at: str

# ============ CHAT FILTER UTILITIES ============

def filter_external_contact(text: str) -> tuple:
    """
    Filter messages to prevent sharing external contact info.
    Returns (filtered_text, was_blocked, reason)
    """
    original = text
    blocked = False
    reasons = []
    
    # Phone patterns (various formats)
    phone_patterns = [
        r'\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{0,4}',
        r'\d{9,}',
        r'\d{3}[-.\s]\d{3}[-.\s]\d{3,4}',
    ]
    for pattern in phone_patterns:
        if re.search(pattern, text):
            text = re.sub(pattern, '[NÚMERO OCULTO]', text)
            blocked = True
            reasons.append('número de teléfono')
    
    # Email patterns
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    if re.search(email_pattern, text):
        text = re.sub(email_pattern, '[EMAIL OCULTO]', text)
        blocked = True
        reasons.append('email')
    
    # Social media patterns
    social_patterns = [
        (r'@[a-zA-Z0-9_]{3,}', 'usuario de red social'),
        (r'(?:instagram|ig|insta)[\s:]*[a-zA-Z0-9._]+', 'Instagram'),
        (r'(?:whatsapp|wsp|whats)[\s:]*[\d+]+', 'WhatsApp'),
        (r'(?:telegram|tg)[\s:]*[a-zA-Z0-9_]+', 'Telegram'),
        (r'(?:facebook|fb)[\s:./]*[a-zA-Z0-9.]+', 'Facebook'),
        (r'(?:twitter|tw)[\s:./]*[a-zA-Z0-9_]+', 'Twitter'),
    ]
    for pattern, name in social_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            text = re.sub(pattern, f'[{name.upper()} OCULTO]', text, flags=re.IGNORECASE)
            blocked = True
            reasons.append(name)
    
    # URL patterns
    url_pattern = r'https?://[^\s]+'
    if re.search(url_pattern, text):
        text = re.sub(url_pattern, '[ENLACE OCULTO]', text)
        blocked = True
        reasons.append('enlace')
    
    reason = ', '.join(set(reasons)) if reasons else None
    return text, blocked, reason

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

# ============ STRIPE PAYMENT ROUTES ============

@api_router.post("/payments/stripe/subscription")
async def create_stripe_subscription(request_data: SubscriptionRequest, http_request: Request, current_user: User = Depends(get_current_user)):
    """Create Stripe checkout session for transporter subscription"""
    if "transportista" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Solo los transportistas pueden suscribirse")
    
    # Check if already subscribed
    existing_sub = await db.subscriptions.find_one({
        "user_id": current_user.id,
        "status": "active"
    })
    if existing_sub:
        raise HTTPException(status_code=400, detail="Ya tienes una suscripción activa")
    
    try:
        webhook_url = f"{str(http_request.base_url).rstrip('/')}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        success_url = f"{request_data.origin_url}/payments/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{request_data.origin_url}/payments/cancel"
        
        checkout_request = CheckoutSessionRequest(
            amount=SUBSCRIPTION_PRICE,
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": current_user.id,
                "user_email": current_user.email,
                "payment_type": "subscription"
            }
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        transaction_id = str(uuid.uuid4())
        transaction_doc = {
            "id": transaction_id,
            "user_id": current_user.id,
            "user_email": current_user.email,
            "session_id": session.session_id,
            "amount": SUBSCRIPTION_PRICE,
            "currency": "usd",
            "payment_type": "subscription",
            "payment_method": "stripe",
            "status": "pending",
            "metadata": {
                "user_id": current_user.id,
                "user_email": current_user.email,
                "payment_type": "subscription"
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction_doc)
        
        return {"url": session.url, "session_id": session.session_id}
    
    except Exception as e:
        logger.error(f"Error creating Stripe subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al crear sesión de pago: {str(e)}")

@api_router.post("/payments/stripe/commission")
async def create_stripe_commission(request_data: CommissionPaymentRequest, http_request: Request, current_user: User = Depends(get_current_user)):
    """Create Stripe checkout session for commission payment after accepting offer"""
    # Get the request and calculate commission
    transport_request = await db.transport_requests.find_one({"id": request_data.solicitud_id})
    if not transport_request:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    
    accepted_offer = await db.offers.find_one({
        "solicitud_id": request_data.solicitud_id,
        "estado": "aceptada"
    })
    if not accepted_offer:
        raise HTTPException(status_code=400, detail="No hay oferta aceptada para esta solicitud")
    
    commission_amount = round(accepted_offer["precio_oferta"] * COMMISSION_RATE, 2)
    
    try:
        webhook_url = f"{str(http_request.base_url).rstrip('/')}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        success_url = f"{request_data.origin_url}/payments/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{request_data.origin_url}/request/{request_data.solicitud_id}"
        
        checkout_request = CheckoutSessionRequest(
            amount=commission_amount,
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": current_user.id,
                "user_email": current_user.email,
                "payment_type": "commission",
                "solicitud_id": request_data.solicitud_id,
                "offer_amount": str(accepted_offer["precio_oferta"])
            }
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        transaction_id = str(uuid.uuid4())
        transaction_doc = {
            "id": transaction_id,
            "user_id": current_user.id,
            "user_email": current_user.email,
            "session_id": session.session_id,
            "amount": commission_amount,
            "currency": "usd",
            "payment_type": "commission",
            "payment_method": "stripe",
            "status": "pending",
            "metadata": {
                "user_id": current_user.id,
                "user_email": current_user.email,
                "payment_type": "commission",
                "solicitud_id": request_data.solicitud_id,
                "offer_amount": str(accepted_offer["precio_oferta"])
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction_doc)
        
        return {"url": session.url, "session_id": session.session_id, "commission_amount": commission_amount}
    
    except Exception as e:
        logger.error(f"Error creating Stripe commission payment: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al crear sesión de pago: {str(e)}")

@api_router.get("/payments/stripe/status/{session_id}")
async def get_stripe_payment_status(session_id: str, http_request: Request, current_user: User = Depends(get_current_user)):
    """Get Stripe payment status and update transaction"""
    try:
        webhook_url = f"{str(http_request.base_url).rstrip('/')}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        checkout_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction in database
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        if transaction:
            new_status = "paid" if checkout_status.payment_status == "paid" else checkout_status.status
            
            # Only update if not already processed
            if transaction["status"] != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "status": new_status,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # If subscription paid, create subscription record
                if new_status == "paid" and transaction["payment_type"] == "subscription":
                    sub_doc = {
                        "id": str(uuid.uuid4()),
                        "user_id": transaction["user_id"],
                        "status": "active",
                        "start_date": datetime.now(timezone.utc).isoformat(),
                        "end_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                        "amount": SUBSCRIPTION_PRICE,
                        "payment_method": "stripe"
                    }
                    await db.subscriptions.insert_one(sub_doc)
        
        return {
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "amount": checkout_status.amount_total / 100,  # Convert from cents
            "currency": checkout_status.currency
        }
    
    except Exception as e:
        logger.error(f"Error getting Stripe payment status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al verificar estado del pago: {str(e)}")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            # Update transaction
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {
                    "status": "paid",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        return {"status": "processed"}
    
    except Exception as e:
        logger.error(f"Stripe webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}

# ============ SUBSCRIPTION STATUS ============

@api_router.get("/subscription/status")
async def get_subscription_status(current_user: User = Depends(get_current_user)):
    """Get current user's subscription status"""
    if "transportista" not in current_user.roles:
        return {"has_subscription": False, "message": "Solo transportistas necesitan suscripción"}
    
    subscription = await db.subscriptions.find_one({
        "user_id": current_user.id,
        "status": "active"
    }, {"_id": 0})
    
    if subscription:
        end_date = datetime.fromisoformat(subscription["end_date"].replace('Z', '+00:00'))
        if end_date > datetime.now(timezone.utc):
            return {
                "has_subscription": True,
                "subscription": subscription,
                "days_remaining": (end_date - datetime.now(timezone.utc)).days
            }
        else:
            # Subscription expired
            await db.subscriptions.update_one(
                {"id": subscription["id"]},
                {"$set": {"status": "expired"}}
            )
    
    return {"has_subscription": False, "message": "No tienes suscripción activa"}

@api_router.get("/payments/history")
async def get_payment_history(current_user: User = Depends(get_current_user)):
    """Get user's payment history"""
    payments = await db.payment_transactions.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return payments

# ============ CHAT ROUTES ============

@api_router.post("/chat/messages")
async def send_message(message_data: MessageCreate, current_user: User = Depends(get_current_user)):
    """Send a message in a request chat (with external contact filtering)"""
    # Get the request
    transport_request = await db.transport_requests.find_one({"id": message_data.solicitud_id})
    if not transport_request:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    
    # Determine receiver (client or transporter)
    if current_user.id == transport_request["cliente_id"]:
        # Sender is client, find transporter from accepted offer
        accepted_offer = await db.offers.find_one({
            "solicitud_id": message_data.solicitud_id,
            "estado": "aceptada"
        })
        if not accepted_offer:
            raise HTTPException(status_code=400, detail="No hay oferta aceptada para esta solicitud")
        receiver_id = accepted_offer["transportista_id"]
    else:
        # Sender is transporter, receiver is client
        receiver_id = transport_request["cliente_id"]
    
    # Filter message for external contact info
    filtered_content, was_blocked, block_reason = filter_external_contact(message_data.contenido)
    
    message_id = str(uuid.uuid4())
    message_doc = {
        "id": message_id,
        "solicitud_id": message_data.solicitud_id,
        "sender_id": current_user.id,
        "sender_nombre": current_user.nombre,
        "receiver_id": receiver_id,
        "contenido": filtered_content,
        "contenido_original": message_data.contenido if was_blocked else None,
        "bloqueado": was_blocked,
        "razon_bloqueo": block_reason,
        "leido": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message_doc)
    
    # Create notification for receiver
    notification_doc = {
        "id": str(uuid.uuid4()),
        "user_id": receiver_id,
        "tipo": "message",
        "titulo": f"Nuevo mensaje de {current_user.nombre}",
        "mensaje": filtered_content[:100] + "..." if len(filtered_content) > 100 else filtered_content,
        "link": f"/request/{message_data.solicitud_id}",
        "leida": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    response = {k: v for k, v in message_doc.items() if k != "_id"}
    
    if was_blocked:
        response["warning"] = f"Se ha detectado y ocultado información de contacto externo ({block_reason}). Por favor, mantén las negociaciones dentro de la plataforma."
    
    return response

@api_router.get("/chat/messages/{solicitud_id}")
async def get_messages(solicitud_id: str, current_user: User = Depends(get_current_user)):
    """Get all messages for a request"""
    # Verify user has access to this chat
    transport_request = await db.transport_requests.find_one({"id": solicitud_id})
    if not transport_request:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    
    # Check if user is involved
    accepted_offer = await db.offers.find_one({
        "solicitud_id": solicitud_id,
        "estado": "aceptada"
    })
    
    if current_user.id != transport_request["cliente_id"]:
        if not accepted_offer or current_user.id != accepted_offer["transportista_id"]:
            raise HTTPException(status_code=403, detail="No tienes acceso a este chat")
    
    messages = await db.messages.find(
        {"solicitud_id": solicitud_id},
        {"_id": 0, "contenido_original": 0}
    ).sort("created_at", 1).to_list(500)
    
    # Mark messages as read
    await db.messages.update_many(
        {"solicitud_id": solicitud_id, "receiver_id": current_user.id, "leido": False},
        {"$set": {"leido": True}}
    )
    
    return messages

@api_router.get("/chat/unread-count")
async def get_unread_count(current_user: User = Depends(get_current_user)):
    """Get count of unread messages"""
    count = await db.messages.count_documents({
        "receiver_id": current_user.id,
        "leido": False
    })
    return {"unread_count": count}

# ============ NOTIFICATION ROUTES ============

@api_router.get("/notifications")
async def get_notifications(current_user: User = Depends(get_current_user)):
    """Get user notifications"""
    notifications = await db.notifications.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return notifications

@api_router.get("/notifications/unread-count")
async def get_unread_notification_count(current_user: User = Depends(get_current_user)):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({
        "user_id": current_user.id,
        "leida": False
    })
    return {"unread_count": count}

@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: User = Depends(get_current_user)):
    """Mark notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user.id},
        {"$set": {"leida": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return {"message": "Notificación marcada como leída"}

@api_router.patch("/notifications/read-all")
async def mark_all_notifications_read(current_user: User = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user.id, "leida": False},
        {"$set": {"leida": True}}
    )
    return {"message": "Todas las notificaciones marcadas como leídas"}

# ============ VERIFICATION ROUTES ============

@api_router.post("/verification/identity")
async def submit_identity_verification(
    tipo_documento: str,
    numero_documento: str,
    documento_imagen: str,
    selfie_imagen: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Submit identity verification documents"""
    # Check if already has pending or approved verification
    existing = await db.identity_verifications.find_one({
        "user_id": current_user.id,
        "status": {"$in": ["pending", "approved"]}
    })
    if existing:
        if existing["status"] == "approved":
            raise HTTPException(status_code=400, detail="Tu identidad ya está verificada")
        raise HTTPException(status_code=400, detail="Ya tienes una verificación pendiente")
    
    verification_id = str(uuid.uuid4())
    verification_doc = {
        "id": verification_id,
        "user_id": current_user.id,
        "tipo_documento": tipo_documento,
        "numero_documento": numero_documento,
        "documento_imagen": documento_imagen,
        "selfie_imagen": selfie_imagen,
        "status": "pending",
        "admin_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.identity_verifications.insert_one(verification_doc)
    
    # Update user verification status
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"identity_verification_status": "pending"}}
    )
    
    return {"id": verification_id, "status": "pending", "message": "Verificación enviada correctamente"}

@api_router.get("/verification/identity/status")
async def get_identity_verification_status(current_user: User = Depends(get_current_user)):
    """Get identity verification status"""
    verification = await db.identity_verifications.find_one(
        {"user_id": current_user.id},
        {"_id": 0, "documento_imagen": 0, "selfie_imagen": 0}
    )
    
    if not verification:
        return {"status": "not_submitted", "message": "No has enviado verificación de identidad"}
    
    return verification

@api_router.post("/verification/vehicle")
async def submit_vehicle_verification(
    tipo_vehiculo: str,
    marca: str,
    modelo: str,
    ano: int,
    matricula: str,
    foto_vehiculo: str,
    foto_matricula: str,
    permiso_circulacion: Optional[str] = None,
    seguro_imagen: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Submit vehicle verification documents (transporters only)"""
    if "transportista" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Solo transportistas pueden verificar vehículos")
    
    # Check if already has pending or approved verification for this plate
    existing = await db.vehicle_verifications.find_one({
        "user_id": current_user.id,
        "matricula": matricula,
        "status": {"$in": ["pending", "approved"]}
    })
    if existing:
        if existing["status"] == "approved":
            raise HTTPException(status_code=400, detail="Este vehículo ya está verificado")
        raise HTTPException(status_code=400, detail="Ya tienes una verificación pendiente para este vehículo")
    
    verification_id = str(uuid.uuid4())
    verification_doc = {
        "id": verification_id,
        "user_id": current_user.id,
        "tipo_vehiculo": tipo_vehiculo,
        "marca": marca,
        "modelo": modelo,
        "ano": ano,
        "matricula": matricula,
        "foto_vehiculo": foto_vehiculo,
        "foto_matricula": foto_matricula,
        "permiso_circulacion": permiso_circulacion,
        "seguro_imagen": seguro_imagen,
        "status": "pending",
        "admin_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vehicle_verifications.insert_one(verification_doc)
    
    # Update user vehicle verification status
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"vehicle_verification_status": "pending"}}
    )
    
    return {"id": verification_id, "status": "pending", "message": "Verificación de vehículo enviada correctamente"}

@api_router.get("/verification/vehicle/status")
async def get_vehicle_verification_status(current_user: User = Depends(get_current_user)):
    """Get vehicle verification status"""
    verifications = await db.vehicle_verifications.find(
        {"user_id": current_user.id},
        {"_id": 0, "foto_vehiculo": 0, "foto_matricula": 0, "permiso_circulacion": 0, "seguro_imagen": 0}
    ).to_list(10)
    
    if not verifications:
        return {"status": "not_submitted", "vehicles": [], "message": "No has enviado verificación de vehículo"}
    
    return {"vehicles": verifications}

@api_router.get("/verification/all")
async def get_all_verification_status(current_user: User = Depends(get_current_user)):
    """Get all verification statuses for current user"""
    identity = await db.identity_verifications.find_one(
        {"user_id": current_user.id},
        {"_id": 0, "documento_imagen": 0, "selfie_imagen": 0}
    )
    
    vehicles = await db.vehicle_verifications.find(
        {"user_id": current_user.id},
        {"_id": 0, "foto_vehiculo": 0, "foto_matricula": 0, "permiso_circulacion": 0, "seguro_imagen": 0}
    ).to_list(10)
    
    return {
        "identity": identity if identity else {"status": "not_submitted"},
        "vehicles": vehicles,
        "is_identity_verified": identity["status"] == "approved" if identity else False,
        "has_verified_vehicle": any(v["status"] == "approved" for v in vehicles) if vehicles else False
    }

# ============ PROFILE UPDATE ROUTES ============

@api_router.patch("/users/me/profile")
async def update_profile(
    nombre: Optional[str] = None,
    telefono: Optional[str] = None,
    foto_perfil: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Update user profile"""
    update_data = {}
    if nombre:
        update_data["nombre"] = nombre
    if telefono:
        update_data["telefono"] = telefono
    if foto_perfil:
        update_data["foto_perfil"] = foto_perfil
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": update_data}
    )
    
    updated_user = await db.users.find_one({"id": current_user.id}, {"_id": 0, "hashed_password": 0})
    return updated_user

# ============ ADMIN ROUTES ============

@api_router.get("/admin/stats")
async def get_admin_stats(admin: User = Depends(get_admin_user)):
    """Get admin dashboard statistics"""
    total_users = await db.users.count_documents({})
    total_requests = await db.transport_requests.count_documents({})
    pending_identity = await db.identity_verifications.count_documents({"status": "pending"})
    pending_vehicle = await db.vehicle_verifications.count_documents({"status": "pending"})
    total_transactions = await db.payment_transactions.count_documents({"status": "paid"})
    
    return {
        "total_users": total_users,
        "total_requests": total_requests,
        "pending_identity_verifications": pending_identity,
        "pending_vehicle_verifications": pending_vehicle,
        "total_paid_transactions": total_transactions
    }

@api_router.get("/admin/verifications/identity")
async def get_identity_verifications(status: Optional[str] = "pending", admin: User = Depends(get_admin_user)):
    """Get all identity verifications (admin only)"""
    query = {}
    if status:
        query["status"] = status
    
    verifications = await db.identity_verifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add user info to each verification
    for v in verifications:
        user = await db.users.find_one({"id": v["user_id"]}, {"_id": 0, "hashed_password": 0})
        v["user"] = user
    
    return verifications

@api_router.get("/admin/verifications/vehicle")
async def get_vehicle_verifications(status: Optional[str] = "pending", admin: User = Depends(get_admin_user)):
    """Get all vehicle verifications (admin only)"""
    query = {}
    if status:
        query["status"] = status
    
    verifications = await db.vehicle_verifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add user info to each verification
    for v in verifications:
        user = await db.users.find_one({"id": v["user_id"]}, {"_id": 0, "hashed_password": 0})
        v["user"] = user
    
    return verifications

@api_router.patch("/admin/verifications/identity/{verification_id}")
async def update_identity_verification(
    verification_id: str,
    status: str,
    admin_notes: Optional[str] = None,
    admin: User = Depends(get_admin_user)
):
    """Approve or reject identity verification (admin only)"""
    if status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status debe ser 'approved' o 'rejected'")
    
    verification = await db.identity_verifications.find_one({"id": verification_id})
    if not verification:
        raise HTTPException(status_code=404, detail="Verificación no encontrada")
    
    await db.identity_verifications.update_one(
        {"id": verification_id},
        {"$set": {
            "status": status,
            "admin_notes": admin_notes,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": admin.id
        }}
    )
    
    # Update user verification status
    await db.users.update_one(
        {"id": verification["user_id"]},
        {"$set": {"identity_verification_status": status}}
    )
    
    # Create notification for user
    notification_doc = {
        "id": str(uuid.uuid4()),
        "user_id": verification["user_id"],
        "tipo": "verification",
        "titulo": "Verificación de Identidad " + ("Aprobada ✓" if status == "approved" else "Rechazada"),
        "mensaje": admin_notes if admin_notes else ("Tu identidad ha sido verificada correctamente." if status == "approved" else "Tu verificación fue rechazada. Por favor, intenta de nuevo."),
        "link": "/profile",
        "leida": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    return {"message": f"Verificación {status}", "verification_id": verification_id}

@api_router.patch("/admin/verifications/vehicle/{verification_id}")
async def update_vehicle_verification(
    verification_id: str,
    status: str,
    admin_notes: Optional[str] = None,
    admin: User = Depends(get_admin_user)
):
    """Approve or reject vehicle verification (admin only)"""
    if status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status debe ser 'approved' o 'rejected'")
    
    verification = await db.vehicle_verifications.find_one({"id": verification_id})
    if not verification:
        raise HTTPException(status_code=404, detail="Verificación no encontrada")
    
    await db.vehicle_verifications.update_one(
        {"id": verification_id},
        {"$set": {
            "status": status,
            "admin_notes": admin_notes,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": admin.id
        }}
    )
    
    # Update user vehicle verification status
    if status == "approved":
        await db.users.update_one(
            {"id": verification["user_id"]},
            {"$set": {"has_verified_vehicle": True}}
        )
    
    # Create notification for user
    notification_doc = {
        "id": str(uuid.uuid4()),
        "user_id": verification["user_id"],
        "tipo": "verification",
        "titulo": f"Verificación de Vehículo ({verification['matricula']}) " + ("Aprobada ✓" if status == "approved" else "Rechazada"),
        "mensaje": admin_notes if admin_notes else ("Tu vehículo ha sido verificado correctamente." if status == "approved" else "La verificación de tu vehículo fue rechazada. Por favor, intenta de nuevo."),
        "link": "/profile",
        "leida": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    return {"message": f"Verificación {status}", "verification_id": verification_id}

@api_router.get("/admin/users")
async def get_all_users(admin: User = Depends(get_admin_user)):
    """Get all users (admin only)"""
    users = await db.users.find(
        {},
        {"_id": 0, "hashed_password": 0}
    ).sort("created_at", -1).to_list(500)
    return users

@api_router.patch("/admin/users/{user_id}/role")
async def update_user_role(user_id: str, roles: List[str], admin: User = Depends(get_admin_user)):
    """Update user roles (admin only)"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"roles": roles}}
    )
    
    return {"message": "Roles actualizados", "user_id": user_id, "roles": roles}

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
