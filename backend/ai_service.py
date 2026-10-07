import os
import json
from flask import Flask, request, jsonify
from PIL import Image
from transformers import AutoProcessor, PaliGemmaForConditionalGeneration
import torch

app = Flask(__name__)

# Load the model and processor once on startup
# We use google/paligemma-3b-mix-224 as it is lightweight and fine-tuned for general VQA
MODEL_ID = "google/paligemma-3b-mix-224"
print(f"Loading {MODEL_ID}...")

# Use CPU if CUDA is not available (Render might not have GPUs on standard tiers)
device = "cuda" if torch.cuda.is_available() else "cpu"

try:
    processor = AutoProcessor.from_pretrained(MODEL_ID)
    model = PaliGemmaForConditionalGeneration.from_pretrained(MODEL_ID).to(device)
    print("Model loaded successfully!")
except Exception as e:
    print(f"Failed to load model: {e}")
    print("Note: You must accept the Gemma license on HuggingFace and set HF_TOKEN environment variable.")
    model = None
    processor = None

@app.route('/analyze', methods=['POST'])
def analyze_image():
    if not model or not processor:
        return jsonify({"error": "Model not loaded. Check HF_TOKEN."}), 500
        
    if 'photo' not in request.files:
        return jsonify({"error": "No photo provided"}), 400
        
    photo_file = request.files['photo']
    image = Image.open(photo_file).convert("RGB")
    
    # We ask PaliGemma to output a structured JSON about the place
    prompt = (
        "Analyze this outdoor location photo and output a JSON object with these exact keys: "
        "'tags' (a list of 1-3 lowercase words describing the location type like 'waterfall', 'ruins', 'park', 'viewpoint'), "
        "'vibe' (a 1-3 word description of the atmosphere), "
        "'bestTimeOfDay' (suggested time to visit), "
        "'hazards' (a boolean object with keys: 'privateProperty', 'unstableStructures', 'water', 'wildlife' based on what you see). "
        "Output ONLY valid JSON."
    )
    
    # The format PaliGemma expects: "caption image" or just the prompt
    inputs = processor(text=prompt, images=image, return_tensors="pt").to(device)
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs, 
            max_new_tokens=150, 
            do_sample=False
        )
        
    generated_text = processor.decode(outputs[0], skip_special_tokens=True)
    # The model usually outputs the prompt + the answer, we strip the prompt out
    result = generated_text[len(prompt):].strip()
    
    # Try to parse the output as JSON
    try:
        # Find the JSON block if the model added some conversational text
        json_start = result.find('{')
        json_end = result.rfind('}') + 1
        
        if json_start >= 0 and json_end > json_start:
            json_str = result[json_start:json_end]
            structured_data = json.loads(json_str)
            return jsonify(structured_data)
        else:
            raise ValueError("No JSON block found")
    except Exception as e:
        # Fallback if the model didn't format properly
        print(f"Failed to parse model output as JSON: {result}")
        return jsonify({
            "tags": ["outdoor"],
            "vibe": "unknown",
            "bestTimeOfDay": "daytime",
            "hazards": {
                "privateProperty": False,
                "unstableStructures": False,
                "water": False,
                "wildlife": False
            },
            "raw_output": result
        })

if __name__ == '__main__':
    app.run(port=5001)
