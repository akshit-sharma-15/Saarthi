from typing import Literal
from langgraph.graph import StateGraph, START, END
from backend.app.graph.state import GraphState
from backend.app.graph.nodes import (
    parse_node,
    compute_facts_node,
    evaluate_node,
    validate_node,
    retry_node,
    document_node,
    dispatch_node
)

def route_after_validation(state: GraphState) -> Literal["document_node", "retry_node"]:
    """
    Routes based on validation success or retry allowance (max 2 retries).
    """
    if state.get("evaluation") is not None and not state.get("validation_errors"):
        return "document_node"
    
    retry_count = state.get("retry_count", 0)
    if retry_count <= 2:
        return "retry_node"
    
    # If exceeded max retries, proceed to document generation with fallback
    return "document_node"

def build_recruiter_graph():
    """
    Constructs and compiles the AI Recruiter Copilot LangGraph pipeline.
    """
    builder = StateGraph(GraphState)

    # Add nodes
    builder.add_node("parse_node", parse_node)
    builder.add_node("compute_facts_node", compute_facts_node)
    builder.add_node("evaluate_node", evaluate_node)
    builder.add_node("validate_node", validate_node)
    builder.add_node("retry_node", retry_node)
    builder.add_node("document_node", document_node)
    builder.add_node("dispatch_node", dispatch_node)

    # Add edges
    builder.add_edge(START, "parse_node")
    builder.add_edge("parse_node", "compute_facts_node")
    builder.add_edge("compute_facts_node", "evaluate_node")
    builder.add_edge("evaluate_node", "validate_node")

    # Conditional routing after validate_node
    builder.add_conditional_edges(
        "validate_node",
        route_after_validation,
        {
            "retry_node": "retry_node",
            "document_node": "document_node"
        }
    )

    # Retry loop feeds back into validate_node
    builder.add_edge("retry_node", "validate_node")

    # Final document and dispatch chain
    builder.add_edge("document_node", "dispatch_node")
    builder.add_edge("dispatch_node", END)

    return builder.compile()

# Pre-compiled graph instance
recruiter_graph = build_recruiter_graph()
