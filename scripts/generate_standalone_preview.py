import os

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
css_path = os.path.join(root, 'app.bundle.css')
js_path = os.path.join(root, 'app.bundle.js')

with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

with open(js_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

html = f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="description" content="ARV KKBK - Antiretroviral Personal Record Tracker" />
    <title>ARV KKBK - Live Application Preview</title>
    <style>
{css_content}
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
{js_content}
    </script>
  </body>
</html>"""

out_path = os.path.join(root, 'live_preview.html')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Generated live_preview.html successfully:", os.path.getsize(out_path), "bytes")
