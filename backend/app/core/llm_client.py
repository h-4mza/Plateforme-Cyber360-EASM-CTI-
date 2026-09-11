import os
import asyncio
import logging
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

async def call_llm(system_prompt: str, user_prompt: str, max_tokens: int = 2000) -> dict:
    """
    Appelle le modèle LLM Gemini avec gestion stricte des erreurs (timeouts, retries).
    Retourne un dictionnaire contenant la réponse brute ('text') et les métadonnées de coût ('usage', 'model').
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("La clé GEMINI_API_KEY n'est pas configurée.")
        
    # On utilise gemini-3.5-flash-lite comme modèle rapide par défaut, adapté aux tâches JSON.
    model_name = "gemini-3.5-flash-lite"
    client = genai.Client(api_key=api_key)
    
    max_retries = 2
    retry_delay = 1.0 # Secondes
    
    for attempt in range(max_retries + 1):
        try:
            # L'appel au SDK de google-genai
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=model_name,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.2,
                    response_mime_type="application/json",
                    max_output_tokens=max_tokens,
                )
            )
            
            # Si succès, on retourne immédiatement
            return {
                "text": response.text,
                "model": model_name,
                "prompt_tokens": response.usage_metadata.prompt_token_count if response.usage_metadata else 0,
                "completion_tokens": response.usage_metadata.candidates_token_count if response.usage_metadata else 0,
            }
            
        except Exception as e:
            error_str = str(e).lower()
            logger.warning(f"Tentative {attempt + 1}/{max_retries + 1} échouée pour call_llm: {e}")
            
            # Ne jamais retry sur une erreur de clé ou de prompt mal formaté (équivalent 4xx)
            if "invalid api key" in error_str or "unauthorized" in error_str or "400" in error_str or "403" in error_str or "404" in error_str:
                raise ValueError(f"Erreur d'authentification ou de requête (4xx) avec l'API LLM : {e}")
                
            # Gestion explicite du "Rate Limit" (Free tier = 15 requêtes/min sur Gemini)
            if "429" in error_str or "quota" in error_str or "resource exhausted" in error_str:
                raise RuntimeError("Le quota gratuit de l'API (15 requêtes / minute) a été dépassé. Veuillez patienter une minute avant de réessayer.")
                
            if attempt == max_retries:
                raise RuntimeError(f"L'API LLM n'a pas répondu après {max_retries + 1} tentatives : {e}")
                
            # Attente exponentielle légère avant retry
            await asyncio.sleep(retry_delay * (attempt + 1))
            
    raise RuntimeError("Erreur inattendue dans la boucle call_llm.")
