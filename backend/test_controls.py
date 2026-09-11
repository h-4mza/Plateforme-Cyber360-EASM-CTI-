import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta, timezone
import httpx
from app.modules.discovery.tasks import get_cert_status, check_http_redirect

class TestControls(unittest.TestCase):

    def test_get_cert_status(self):
        now = datetime.now(timezone.utc)
        
        # Cas 1: Déjà expiré (ex: -1 jour)
        expired_date = now - timedelta(days=1)
        self.assertEqual(get_cert_status(expired_date), "Critique")
        
        # Cas 2: Expire dans moins de 15 jours (ex: 10 jours)
        less_than_15 = now + timedelta(days=10)
        self.assertEqual(get_cert_status(less_than_15), "Important")
        
        # Cas 3: Exactement 15 jours (days=15) -> Doit tomber dans < 30 (donc Moyen)
        # Note: since delta is calculated in whole days via .days, adding exactly 15 days is 15.0 days.
        exactly_15 = now + timedelta(days=15, hours=1) # +1 hour to ensure it's >= 15 days delta
        self.assertEqual(get_cert_status(exactly_15), "Moyen")
        
        # Cas 4: Expire dans moins de 30 jours (ex: 20 jours)
        less_than_30 = now + timedelta(days=20)
        self.assertEqual(get_cert_status(less_than_30), "Moyen")
        
        # Cas 5: Exactement 30 jours -> Doit tomber dans OK
        exactly_30 = now + timedelta(days=30, hours=1)
        self.assertEqual(get_cert_status(exactly_30), "OK")
        
        # Cas 6: Plus de 30 jours (ex: 60 jours)
        more_than_30 = now + timedelta(days=60)
        self.assertEqual(get_cert_status(more_than_30), "OK")

    @patch('app.modules.discovery.tasks.socket.create_connection')
    @patch('app.modules.discovery.tasks.httpx.Client')
    def test_check_http_redirect(self, mock_httpx_client, mock_socket):
        # Mock port 80 is open
        mock_socket.return_value = MagicMock()
        
        # Mock HTTPX response
        mock_client_instance = MagicMock()
        mock_httpx_client.return_value.__enter__.return_value = mock_client_instance
        
        # Cas 1: Redirection valide (301) vers HTTPS
        mock_resp_valid = MagicMock()
        mock_resp_valid.status_code = 301
        mock_resp_valid.headers = {"location": "https://example.com"}
        mock_client_instance.get.return_value = mock_resp_valid
        
        self.assertEqual(check_http_redirect("example.com"), "Conforme")
        
        # Cas 2: Pas de redirection (200 OK en clair)
        mock_resp_invalid = MagicMock()
        mock_resp_invalid.status_code = 200
        mock_resp_invalid.headers = {}
        mock_client_instance.get.return_value = mock_resp_invalid
        
        self.assertEqual(check_http_redirect("example.com"), "Non conforme")
        
        # Cas 3: Redirection invalide (302 vers HTTP)
        mock_resp_invalid_http = MagicMock()
        mock_resp_invalid_http.status_code = 302
        mock_resp_invalid_http.headers = {"location": "http://example.com/login"}
        mock_client_instance.get.return_value = mock_resp_invalid_http
        
        self.assertEqual(check_http_redirect("example.com"), "Non conforme")

    @patch('app.modules.discovery.tasks.socket.create_connection')
    def test_check_http_redirect_port_closed(self, mock_socket):
        # Cas 4: Port 80 fermé
        mock_socket.side_effect = Exception("Connection refused")
        self.assertEqual(check_http_redirect("example.com"), "Non applicable")

if __name__ == '__main__':
    unittest.main()
