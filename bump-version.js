#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function bumpPatch(version) {
  const parts = version.split(".").map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join(".");
}

const packagePath = path.join(__dirname, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const nextVersion = bumpPatch(packageJson.version);
packageJson.version = nextVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + "\n", "utf8");

const manifestPath = path.join(__dirname, "vss-extension.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.version = nextVersion;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log(`[bump-version] ${nextVersion}`);