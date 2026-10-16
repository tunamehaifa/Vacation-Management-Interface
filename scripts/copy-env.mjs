// Creates backend/.env from .env.example on the first setup; an existing .env is kept.
import { copyFileSync, existsSync } from "node:fs";

if (existsSync("backend/.env")) {
  console.log("backend/.env already exists, kept as is");
} else {
  copyFileSync("backend/.env.example", "backend/.env");
  console.log("Created backend/.env from backend/.env.example");
}
