import pymupdf as fitz
from typing import Union
import os

def extract_text_from_pdf(pdf_source: Union[str, bytes]) -> str:
    """
    Extracts raw text from a PDF file using PyMuPDF (fitz).
    Accepts either a file path string or raw PDF bytes.
    """
    text_chunks = []
    
    if isinstance(pdf_source, bytes):
        doc = fitz.open(stream=pdf_source, filetype="pdf")
    elif isinstance(pdf_source, str):
        if not os.path.exists(pdf_source):
            raise FileNotFoundError(f"PDF file not found: {pdf_source}")
        doc = fitz.open(pdf_source)
    else:
        raise ValueError("pdf_source must be a file path or bytes")

    try:
        for page_num in range(len(doc)):
            page = doc[page_num]
            page_text = page.get_text("text")
            if page_text:
                text_chunks.append(page_text.strip())
    finally:
        doc.close()

    raw_text = "\n\n".join(text_chunks)
    return raw_text.strip()
