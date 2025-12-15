import requests
import sys
from datetime import datetime
import json

class TransportMarketplaceAPITester:
    def __init__(self, base_url="https://cargoconnect-28.preview.emergentagent.com"):
        self.base_url = base_url
        self.cliente_token = None
        self.transportista_token = None
        self.dual_role_token = None
        self.cliente_user = None
        self.transportista_user = None
        self.dual_role_user = None
        self.request_id = None
        self.offer_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, params=params)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "got": response.status_code,
                    "endpoint": endpoint
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e),
                "endpoint": endpoint
            })
            return False, {}

    def test_register_cliente(self):
        """Test user registration as cliente"""
        timestamp = datetime.now().strftime('%H%M%S')
        success, response = self.run_test(
            "Register Cliente",
            "POST",
            "auth/register",
            200,
            data={
                "email": f"cliente_{timestamp}@test.com",
                "password": "TestPass123!",
                "nombre": f"Cliente Test {timestamp}",
                "telefono": "+34 600 111 222",
                "roles": ["cliente"]
            }
        )
        if success and 'token' in response:
            self.cliente_token = response['token']
            self.cliente_user = response['user']
            print(f"   Cliente ID: {self.cliente_user['id']}")
            return True
        return False

    def test_register_transportista(self):
        """Test user registration as transportista"""
        timestamp = datetime.now().strftime('%H%M%S')
        success, response = self.run_test(
            "Register Transportista",
            "POST",
            "auth/register",
            200,
            data={
                "email": f"transportista_{timestamp}@test.com",
                "password": "TestPass123!",
                "nombre": f"Transportista Test {timestamp}",
                "telefono": "+34 600 333 444",
                "roles": ["transportista"]
            }
        )
        if success and 'token' in response:
            self.transportista_token = response['token']
            self.transportista_user = response['user']
            print(f"   Transportista ID: {self.transportista_user['id']}")
            return True
        return False

    def test_register_dual_role(self):
        """Test user registration with both roles"""
        timestamp = datetime.now().strftime('%H%M%S')
        success, response = self.run_test(
            "Register Dual Role (Cliente + Transportista)",
            "POST",
            "auth/register",
            200,
            data={
                "email": f"dual_{timestamp}@test.com",
                "password": "TestPass123!",
                "nombre": f"Dual Role Test {timestamp}",
                "telefono": "+34 600 555 666",
                "roles": ["cliente", "transportista"]
            }
        )
        if success and 'token' in response:
            self.dual_role_token = response['token']
            self.dual_role_user = response['user']
            print(f"   Dual Role User ID: {self.dual_role_user['id']}")
            return True
        return False

    def test_login(self):
        """Test user login"""
        success, response = self.run_test(
            "Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": self.cliente_user['email'],
                "password": "TestPass123!"
            }
        )
        return success and 'token' in response

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200,
            token=self.cliente_token
        )
        return success and response.get('id') == self.cliente_user['id']

    def test_create_request(self):
        """Test creating a transport request"""
        success, response = self.run_test(
            "Create Transport Request",
            "POST",
            "requests",
            200,
            data={
                "titulo": "Transporte de muebles Madrid-Barcelona",
                "descripcion": "Necesito transportar muebles de oficina",
                "origen": "Madrid",
                "destino": "Barcelona",
                "tipo_carga": "Muebles",
                "precio_ofrecido": 250.50
            },
            token=self.cliente_token
        )
        if success and 'id' in response:
            self.request_id = response['id']
            print(f"   Request ID: {self.request_id}")
            return True
        return False

    def test_get_all_requests(self):
        """Test getting all requests"""
        success, response = self.run_test(
            "Get All Requests",
            "GET",
            "requests",
            200,
            token=self.transportista_token
        )
        return success and isinstance(response, list)

    def test_get_my_requests(self):
        """Test getting my requests"""
        success, response = self.run_test(
            "Get My Requests",
            "GET",
            "requests/my-requests",
            200,
            token=self.cliente_token
        )
        return success and isinstance(response, list) and len(response) > 0

    def test_get_request_detail(self):
        """Test getting request detail"""
        success, response = self.run_test(
            "Get Request Detail",
            "GET",
            f"requests/{self.request_id}",
            200,
            token=self.transportista_token
        )
        return success and response.get('id') == self.request_id

    def test_create_offer(self):
        """Test creating an offer"""
        success, response = self.run_test(
            "Create Offer",
            "POST",
            "offers",
            200,
            data={
                "solicitud_id": self.request_id,
                "precio_oferta": 230.00,
                "mensaje": "Puedo hacer el transporte con mi camión grande",
                "tipo": "oferta"
            },
            token=self.transportista_token
        )
        if success and 'id' in response:
            self.offer_id = response['id']
            print(f"   Offer ID: {self.offer_id}")
            return True
        return False

    def test_get_offers_for_request(self):
        """Test getting offers for a request"""
        success, response = self.run_test(
            "Get Offers for Request",
            "GET",
            f"offers/request/{self.request_id}",
            200,
            token=self.cliente_token
        )
        return success and isinstance(response, list) and len(response) > 0

    def test_get_my_offers(self):
        """Test getting my offers"""
        success, response = self.run_test(
            "Get My Offers",
            "GET",
            "offers/my-offers",
            200,
            token=self.transportista_token
        )
        return success and isinstance(response, list) and len(response) > 0

    def test_reject_offer(self):
        """Test rejecting an offer (create another offer first)"""
        # Create another offer to reject
        success, response = self.run_test(
            "Create Second Offer (to reject)",
            "POST",
            "offers",
            200,
            data={
                "solicitud_id": self.request_id,
                "precio_oferta": 280.00,
                "mensaje": "Oferta más cara",
                "tipo": "oferta"
            },
            token=self.dual_role_token
        )
        if success and 'id' in response:
            reject_offer_id = response['id']
            success, _ = self.run_test(
                "Reject Offer",
                "PATCH",
                f"offers/{reject_offer_id}/reject",
                200,
                token=self.cliente_token
            )
            return success
        return False

    def test_accept_offer(self):
        """Test accepting an offer"""
        success, response = self.run_test(
            "Accept Offer",
            "PATCH",
            f"offers/{self.offer_id}/accept",
            200,
            token=self.cliente_token
        )
        return success

    def test_update_status_en_transito(self):
        """Test updating request status to en_transito"""
        success, response = self.run_test(
            "Update Status to En Tránsito",
            "PATCH",
            f"requests/{self.request_id}",
            200,
            token=self.transportista_token,
            params={"estado": "en_transito"}
        )
        return success

    def test_update_status_completado(self):
        """Test updating request status to completado"""
        success, response = self.run_test(
            "Update Status to Completado",
            "PATCH",
            f"requests/{self.request_id}",
            200,
            token=self.transportista_token,
            params={"estado": "completado"}
        )
        return success

    def test_create_rating(self):
        """Test creating a rating"""
        success, response = self.run_test(
            "Create Rating",
            "POST",
            "ratings",
            200,
            data={
                "to_user_id": self.transportista_user['id'],
                "solicitud_id": self.request_id,
                "rating": 5,
                "comentario": "Excelente servicio, muy profesional"
            },
            token=self.cliente_token
        )
        return success

    def test_get_user_ratings(self):
        """Test getting user ratings"""
        success, response = self.run_test(
            "Get User Ratings",
            "GET",
            f"ratings/user/{self.transportista_user['id']}",
            200,
            token=self.cliente_token
        )
        return success and isinstance(response, list) and len(response) > 0

    def test_dashboard_stats_cliente(self):
        """Test getting dashboard stats for cliente"""
        success, response = self.run_test(
            "Get Dashboard Stats (Cliente)",
            "GET",
            "dashboard/stats",
            200,
            token=self.cliente_token
        )
        return success and 'cliente' in response

    def test_dashboard_stats_transportista(self):
        """Test getting dashboard stats for transportista"""
        success, response = self.run_test(
            "Get Dashboard Stats (Transportista)",
            "GET",
            "dashboard/stats",
            200,
            token=self.transportista_token
        )
        return success and 'transportista' in response

    def test_dashboard_stats_dual_role(self):
        """Test getting dashboard stats for dual role user"""
        success, response = self.run_test(
            "Get Dashboard Stats (Dual Role)",
            "GET",
            "dashboard/stats",
            200,
            token=self.dual_role_token
        )
        return success and 'cliente' in response and 'transportista' in response

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        success, response = self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={
                "email": "invalid@test.com",
                "password": "wrongpassword"
            }
        )
        return success

    def test_unauthorized_access(self):
        """Test accessing protected endpoint without token"""
        success, response = self.run_test(
            "Unauthorized Access",
            "GET",
            "auth/me",
            401
        )
        return success

    def test_transportista_cannot_create_request(self):
        """Test that transportista-only user cannot create request"""
        success, response = self.run_test(
            "Transportista Cannot Create Request",
            "POST",
            "requests",
            403,
            data={
                "titulo": "Test",
                "descripcion": "Test",
                "origen": "Madrid",
                "destino": "Barcelona",
                "tipo_carga": "Test",
                "precio_ofrecido": 100.00
            },
            token=self.transportista_token
        )
        return success

    def test_cliente_cannot_create_offer(self):
        """Test that cliente-only user cannot create offer"""
        success, response = self.run_test(
            "Cliente Cannot Create Offer",
            "POST",
            "offers",
            403,
            data={
                "solicitud_id": self.request_id,
                "precio_oferta": 200.00,
                "mensaje": "Test",
                "tipo": "oferta"
            },
            token=self.cliente_token
        )
        return success

def main():
    print("=" * 60)
    print("🚚 TRANSPORT MARKETPLACE API TESTING")
    print("=" * 60)
    
    tester = TransportMarketplaceAPITester()

    # Authentication Tests
    print("\n" + "=" * 60)
    print("📝 AUTHENTICATION TESTS")
    print("=" * 60)
    
    if not tester.test_register_cliente():
        print("❌ Cliente registration failed, stopping tests")
        return 1
    
    if not tester.test_register_transportista():
        print("❌ Transportista registration failed, stopping tests")
        return 1
    
    if not tester.test_register_dual_role():
        print("❌ Dual role registration failed, stopping tests")
        return 1
    
    tester.test_login()
    tester.test_get_me()
    tester.test_invalid_login()
    tester.test_unauthorized_access()

    # Request Tests
    print("\n" + "=" * 60)
    print("📦 TRANSPORT REQUEST TESTS")
    print("=" * 60)
    
    if not tester.test_create_request():
        print("❌ Request creation failed, stopping tests")
        return 1
    
    tester.test_get_all_requests()
    tester.test_get_my_requests()
    tester.test_get_request_detail()

    # Offer Tests
    print("\n" + "=" * 60)
    print("💰 OFFER TESTS")
    print("=" * 60)
    
    if not tester.test_create_offer():
        print("❌ Offer creation failed, stopping tests")
        return 1
    
    tester.test_get_offers_for_request()
    tester.test_get_my_offers()
    tester.test_reject_offer()
    tester.test_accept_offer()

    # Status Update Tests
    print("\n" + "=" * 60)
    print("🔄 STATUS UPDATE TESTS")
    print("=" * 60)
    
    tester.test_update_status_en_transito()
    tester.test_update_status_completado()

    # Rating Tests
    print("\n" + "=" * 60)
    print("⭐ RATING TESTS")
    print("=" * 60)
    
    tester.test_create_rating()
    tester.test_get_user_ratings()

    # Dashboard Tests
    print("\n" + "=" * 60)
    print("📊 DASHBOARD TESTS")
    print("=" * 60)
    
    tester.test_dashboard_stats_cliente()
    tester.test_dashboard_stats_transportista()
    tester.test_dashboard_stats_dual_role()

    # Permission Tests
    print("\n" + "=" * 60)
    print("🔒 PERMISSION TESTS")
    print("=" * 60)
    
    tester.test_transportista_cannot_create_request()
    tester.test_cliente_cannot_create_offer()

    # Print results
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS")
    print("=" * 60)
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.failed_tests:
        print("\n❌ Failed Tests:")
        for failed in tester.failed_tests:
            print(f"  - {failed['test']}")
            if 'error' in failed:
                print(f"    Error: {failed['error']}")
            else:
                print(f"    Expected: {failed['expected']}, Got: {failed['got']}")
            print(f"    Endpoint: {failed['endpoint']}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
