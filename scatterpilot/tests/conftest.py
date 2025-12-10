"""
Pytest configuration and fixtures
Adds layers/common to Python path for imports
"""

import sys
import os
from pathlib import Path

# Add layers/common to Python path so tests can import common modules
project_root = Path(__file__).parent.parent
layers_path = project_root / "layers"
sys.path.insert(0, str(layers_path))

# Also add the project root
sys.path.insert(0, str(project_root))
