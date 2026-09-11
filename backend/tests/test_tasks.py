import pytest
import uuid
import asyncio
from unittest.mock import patch, MagicMock

def test_run_active_recon_triggers_inference():
    """
    Test que la tâche run_active_recon appelle bien infer_asset_relations à la fin de 
    son exécution pour garantir le peuplement du graphe AssetRelation.
    """
    from app.modules.discovery.tasks import run_active_recon
    
    test_domain_id = str(uuid.uuid4())
    
    # On mock _process_active_recon pour éviter de vrais appels réseau
    with patch('app.modules.discovery.tasks._process_active_recon') as mock_process:
        # On mock l'appel .delay de celery
        with patch('app.modules.discovery.tasks.infer_asset_relations_task.delay') as mock_delay:
            
            # _process_active_recon est asynchrone, le mock doit retourner une coroutine
            async def mock_coro(*args, **kwargs):
                pass
            mock_process.side_effect = mock_coro
            
            res = run_active_recon(test_domain_id)
            
            assert res["status"] == "success"
            assert res["domain_id"] == test_domain_id
            
            # Vérifier que l'inférence a été déclenchée (le chaînage fonctionne)
            mock_delay.assert_called_once_with(test_domain_id)
