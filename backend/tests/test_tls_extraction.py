import pytest
from unittest.mock import patch, MagicMock
from app.modules.discovery.tasks import fetch_tls_cert
import datetime
from cryptography import x509
from cryptography.x509.oid import NameOID, ExtensionOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

def generate_test_cert():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, u"test.azunix.ma"),
    ])
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        private_key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.utcnow()
    ).not_valid_after(
        datetime.datetime.utcnow() + datetime.timedelta(days=10)
    ).add_extension(
        x509.SubjectAlternativeName([
            x509.DNSName(u"test.azunix.ma"),
            x509.DNSName(u"www.test.azunix.ma"),
        ]),
        critical=False,
    ).sign(private_key, hashes.SHA256())
    
    return cert.public_bytes(serialization.Encoding.DER)

@pytest.mark.asyncio
async def test_fetch_tls_cert():
    with patch('app.modules.discovery.tasks.socket.create_connection') as mock_create_connection, \
         patch('app.modules.discovery.tasks.ssl.create_default_context') as mock_ssl_context:
         
        mock_context = MagicMock()
        mock_ssl_context.return_value = mock_context
        
        mock_ssock = MagicMock()
        mock_context.wrap_socket.return_value.__enter__.return_value = mock_ssock
        mock_create_connection.return_value.__enter__.return_value = MagicMock()
        
        der_cert = generate_test_cert()
        mock_ssock.getpeercert.return_value = der_cert
        
        cert_info = fetch_tls_cert("test.azunix.ma")
        
        assert 'subject' in cert_info, "Subject was not extracted"
        assert "CN=test.azunix.ma" in cert_info['subject']
        assert "CN=test.azunix.ma" in cert_info['issuer']
        assert "test.azunix.ma" in cert_info['sans']
        assert "www.test.azunix.ma" in cert_info['sans']

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_fetch_tls_cert())
    print("Test passed successfully!")
