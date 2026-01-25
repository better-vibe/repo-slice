"""Module loader with dynamic imports for testing."""

import importlib


def load_invoice_module():
    """Load the invoice module dynamically using importlib."""
    return importlib.import_module("src.invoice")


def load_by_name(module_name: str):
    """Load a module by name using __import__."""
    return __import__("src.invoice")
