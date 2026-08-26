import React from "react";

interface Props {
  message: string;
}

export const ErrorDisplay: React.FC<Props> = ({ message }) => (
  <div style={{
    padding: "12px 16px",
    background: "#fde8e8",
    color: "#a80000",
    border: "1px solid #a80000",
    borderRadius: 4,
    fontFamily: "Segoe UI, sans-serif",
    fontSize: 13,
  }}>
    <strong>Error:</strong> {message}
  </div>
);
