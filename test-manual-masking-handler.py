#!/usr/bin/env python3
"""
Test script to verify the manual masking workflow handling
"""

import json
from face_swap_serverless_handler import enhance_workflow_for_face_detection, fix_workflow_parameters

# Simple test workflow that mimics Sebastian Kamph structure
test_workflow = {
    "203": {
        "inputs": {
            "image": "original_image.jpg",
            "upload": "image"
        },
        "class_type": "LoadImage",
        "_meta": {
            "title": "Original Image"
        }
    },
    "205": {
        "inputs": {
            "image": "new_face.jpg", 
            "upload": "image"
        },
        "class_type": "LoadImage",
        "_meta": {
            "title": "New Face"
        }
    },
    "221": {
        "inputs": {
            "positive": ["337", 0],
            "negative": ["338", 0],
            "vae": ["214", 2],
            "pixels": ["203", 0],
            "mask": ["402", 0]
        },
        "class_type": "InpaintModelConditioning",
        "_meta": {
            "title": "Inpaint Conditioning"
        }
    },
    "337": {
        "inputs": {
            "model": ["340", 0],
            "clip": ["340", 1],
            "lora_name": "ace_portrait_v10.safetensors",
            "strength_model": 1,
            "strength_clip": 1
        },
        "class_type": "LoraLoader",
        "_meta": {
            "title": "Lora Loader"
        }
    },
    "340": {
        "inputs": {
            "unet_name": "flux1FillDevFp8_v10.safetensors",
            "weight_dtype": "fp8_e4m3fn"
        },
        "class_type": "UNETLoader",
        "_meta": {
            "title": "UNET Loader"
        }
    },
    "402": {
        "inputs": {
            "mask": ["203", 1],
            "width": 512,
            "height": 512
        },
        "class_type": "ResizeMask",
        "_meta": {
            "title": "Resize Mask"
        }
    },
    "411": {
        "inputs": {
            "image": ["203", 0],
            "mask": ["402", 0]
        },
        "class_type": "InpaintCrop",
        "_meta": {
            "title": "Inpaint Crop"
        }
    },
    "412": {
        "inputs": {
            "cropped_image": ["346", 0],
            "original_image": ["203", 0],
            "crop_data": ["411", 1]
        },
        "class_type": "InpaintStitch",
        "_meta": {
            "title": "Inpaint Stitch"
        }
    }
}

def test_workflow_enhancement():
    """Test that the workflow enhancement doesn't add automatic face detection"""
    print("🧪 Testing workflow enhancement...")
    
    # Test the enhance function
    enhanced = enhance_workflow_for_face_detection(test_workflow.copy())
    
    # Check that no automatic face detection nodes were added
    original_nodes = set(test_workflow.keys())
    enhanced_nodes = set(enhanced.keys())
    new_nodes = enhanced_nodes - original_nodes
    
    if new_nodes:
        print(f"❌ ERROR: New nodes were added: {new_nodes}")
        for node_id in new_nodes:
            node = enhanced[node_id]
            print(f"   {node_id}: {node.get('class_type', 'Unknown')} - {node.get('_meta', {}).get('title', 'No title')}")
        return False
    else:
        print("✅ SUCCESS: No automatic face detection nodes added")
        return True

def test_parameter_fixing():
    """Test that parameter fixing works correctly"""
    print("🧪 Testing parameter fixing...")
    
    # Test the fix function
    fixed = fix_workflow_parameters(test_workflow.copy())
    
    # Check specific fixes
    success = True
    
    # Check UNET model name fix
    unet_node = fixed.get("340", {})
    if unet_node.get("inputs", {}).get("unet_name") == "Flux-FillDevFP8.safetensors":
        print("✅ UNET model name correctly mapped")
    else:
        print(f"❌ UNET model name not fixed: {unet_node.get('inputs', {}).get('unet_name')}")
        success = False
    
    # Check InpaintCrop parameters
    inpaint_crop = fixed.get("411", {})
    inputs = inpaint_crop.get("inputs", {})
    if "min_width" in inputs and "min_height" in inputs:
        print("✅ InpaintCrop parameters added")
    else:
        print("❌ InpaintCrop parameters missing")
        success = False
    
    return success

def main():
    """Run all tests"""
    print("🎭 Testing Manual Masking Workflow Handler")
    print("=" * 50)
    
    enhancement_ok = test_workflow_enhancement()
    print()
    parameter_ok = test_parameter_fixing()
    
    print()
    print("=" * 50)
    if enhancement_ok and parameter_ok:
        print("🎉 ALL TESTS PASSED - Handler ready for manual masking workflows!")
    else:
        print("❌ SOME TESTS FAILED - Please check the issues above")
    
    return enhancement_ok and parameter_ok

if __name__ == "__main__":
    main()
