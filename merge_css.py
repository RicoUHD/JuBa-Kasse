import re

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

old_css = read_file('style.css')
new_css = read_file('style.new.css')

# Extract key blocks from old CSS that are needed for Admin
# We want basically everything except :root, body, *, and maybe .container if new handles it.
# Simple approach: Remove :root and body/* blocks from old css and append the rest to new css.

# Regex to remove :root { ... }
old_css_cleaned = re.sub(r':root\s*{[^}]*}', '', old_css)
# Regex to remove * { ... }
old_css_cleaned = re.sub(r'\*\s*{[^}]*}', '', old_css_cleaned)
# Regex to remove body { ... }
old_css_cleaned = re.sub(r'body\s*{[^}]*}', '', old_css_cleaned)
# Remove @import if any
old_css_cleaned = re.sub(r'@import.*;', '', old_css_cleaned)

# Define the missing variable needed for Admin UI (Hero Card)
missing_vars = """
    --gradient-primary: linear-gradient(135deg, #06b6d4 0%, #10b981 100%);
    --gradient-hover: linear-gradient(135deg, #22d3ee 0%, #34d399 100%);
    --surface-alt: #f8fafc;
"""

# Inject missing vars into new_css's :root
new_css_updated = new_css.replace('--radius: 28px;', '--radius: 28px;\n' + missing_vars)

final_css = new_css_updated + "\n\n/* --- LEGACY / ADMIN STYLES --- */\n" + old_css_cleaned

with open('style.css', 'w') as f:
    f.write(final_css)

print("Merged style.css written.")
