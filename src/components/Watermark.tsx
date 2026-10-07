import React from "react";

declare const __PF_VERSION__: string;

const VERSION = typeof __PF_VERSION__ !== "undefined" ? __PF_VERSION__ : "";
const TEXT = `Multi Picker${VERSION ? ` v${VERSION}` : ""} — Powered by Avi Hadad`;

/** Bottom-right attribution line, rendered as a layout row so scrolling content can't cover it. */
export const Watermark: React.FC = () => (
  <div className="pf-watermark" title={TEXT}>{TEXT}</div>
);
