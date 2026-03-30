"""
Setup and test script for the chatbot server
Run this to verify everything is configured correctly
"""

import os
import sys


def check_requirements():
    """Check if all required packages are installed"""
    print("📦 Checking Python dependencies...")
    
    required_packages = {
        'fastapi': 'fastapi',
        'uvicorn': 'uvicorn',
        'google.generativeai': 'google.generativeai',
        'httpx': 'httpx',
        'pydantic': 'pydantic',
        'python-dotenv': 'dotenv'  # Package name vs import name
    }
    
    missing_packages = []
    
    for display_name, import_name in required_packages.items():
        try:
            __import__(import_name)
            print(f"  ✅ {display_name}")
        except ImportError:
            print(f"  ❌ {display_name} - NOT INSTALLED")
            missing_packages.append(display_name)
    
    if missing_packages:
        print("\n⚠️  Missing packages detected!")
        print("Run: pip install -r requirements.txt")
        return False
    
    print("\n✅ All dependencies installed!\n")
    return True


def check_env_file():
    """Check if .env.chatbot file exists and has required variables"""
    print("🔧 Checking environment configuration...")
    
    env_file = '.env.chatbot'
    
    if not os.path.exists(env_file):
        print(f"  ❌ {env_file} not found!")
        print("\n📝 Creating template .env.chatbot file...")
        
        with open(env_file, 'w') as f:
            f.write("# Gemini Chatbot Configuration\n")
            f.write("GOOGLE_API_KEY=your_google_api_key_here\n")
            f.write("NODE_API_URL=http://localhost:5000/api\n")
        
        print(f"  ✅ Created {env_file}")
        print("\n⚠️  IMPORTANT: Add your Google API key to .env.chatbot")
        print("  Get your key from: https://makersuite.google.com/app/apikey")
        return False
    
    print(f"  ✅ {env_file} exists")
    
    # Check if API key is set
    from dotenv import load_dotenv
    load_dotenv(env_file)
    
    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key or api_key == 'your_google_api_key_here':
        print("  ⚠️  GOOGLE_API_KEY not set in .env.chatbot")
        print("  Get your key from: https://makersuite.google.com/app/apikey")
        return False
    
    print("  ✅ GOOGLE_API_KEY is set")
    
    node_api_url = os.getenv('NODE_API_URL')
    if node_api_url:
        print(f"  ✅ NODE_API_URL: {node_api_url}")
    
    print("\n✅ Environment configured!\n")
    return True


def test_gemini_connection():
    """Test connection to Gemini API"""
    print("🤖 Testing Gemini API connection...")
    
    try:
        from dotenv import load_dotenv
        load_dotenv('.env.chatbot')
        
        import google.generativeai as genai
        
        api_key = os.getenv('GOOGLE_API_KEY')
        if not api_key or api_key == 'your_google_api_key_here':
            print("  ⚠️  Cannot test: API key not set")
            return False
        
        genai.configure(api_key=api_key)
        
        # Try to list models to verify connection
        models = genai.list_models()
        print("  ✅ Successfully connected to Gemini API")
        
        # Check if gemini-1.5-flash is available
        flash_available = any('gemini-1.5-flash' in m.name for m in models)
        if flash_available:
            print("  ✅ Gemini 1.5 Flash model is available")
        
        print("\n✅ Gemini API is ready!\n")
        return True
        
    except Exception as e:
        print(f"  ❌ Error connecting to Gemini: {str(e)}")
        return False


def main():
    """Run all checks"""
    print("\n" + "="*60)
    print("  Medical Clinic Chatbot - Setup Verification")
    print("="*60 + "\n")
    
    checks_passed = 0
    total_checks = 3
    
    # Check 1: Dependencies
    if check_requirements():
        checks_passed += 1
    
    # Check 2: Environment file
    if check_env_file():
        checks_passed += 1
    
    # Check 3: Gemini connection
    if test_gemini_connection():
        checks_passed += 1
    
    # Summary
    print("="*60)
    print(f"Setup Check: {checks_passed}/{total_checks} passed")
    print("="*60 + "\n")
    
    if checks_passed == total_checks:
        print("🎉 All checks passed! You're ready to go!")
        print("\nTo start the chatbot server, run:")
        print("  python -m uvicorn chatbot_server:app --reload --port 8000")
        print("\nOr simply:")
        print("  python chatbot_server.py")
    else:
        print("⚠️  Please fix the issues above before starting the server.")
        print("\nNeed help? Check README_CHATBOT.md")
    
    print()


if __name__ == "__main__":
    main()