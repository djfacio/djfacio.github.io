# David Facio — Robotics & Automation Portfolio

Source for **https://djfacio.github.io** — a portfolio of FANUC robotic cells, PLC controls,
vision-guided CNC tending, safety systems, and end-to-end project delivery.

Static HTML/CSS/JS, no build step, published from `main` via GitHub Pages.

## Pages

| Page | Contents |
| --- | --- |
| `index.html` | Main portfolio |
| `case-study-gt-force-32.html` | Machine-mounted robot loader for a gang-tool CNC lathe (IMTS 2024) |
| `case-study-dbr-m8.html` | Recipe-driven robotic deburring cell (IMTS 2024) |
| `case-study-cnc-tending.html` | Three-robot CNC tending system, bone-screw operations |
| `case-study-dual-purpose-cell.html` | Assembly and ultrasonic deburring cell with automatic tool change |
| `case-study-fanuc-ai-tp.html` | Open-source FANUC AI TP Workflow ([repo](https://github.com/djfacio/fanuc-ai-tp)) |
| `robot-programming-example.html` | Sanitized FANUC TP program structure and safe-return homing |
| `tools-handshake-simulator.html` | Interactive robot-to-PLC four-way handshake simulator |
| `tools-project-assessment.html` | Robotic cell project assessment checklist |

## Local preview

```
python -m http.server 8000
```

Then open http://127.0.0.1:8000.

## Publishing rules

Photographs are limited to publicly exhibited machines (IMTS 2024), FANUC Academy training, and
own-bench hardware. All published images are derived from metadata-stripped copies. Customer names,
parts, drawings, and process data do not appear anywhere in this repository.

Contact: djfacio@gmail.com · [LinkedIn](https://www.linkedin.com/in/david-facio-robotics)
