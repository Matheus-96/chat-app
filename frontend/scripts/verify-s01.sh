#!/bin/bash
set -e

echo "Verifying Tailwind CSS + shadcn/ui installation..."

# Check tailwindcss is installed
if npm list tailwindcss 2>/dev/null | grep -q tailwindcss; then
    echo "✅ tailwindcss installed"
else
    echo "❌ tailwindcss not installed"
    exit 1
fi

# Check tailwind.config.ts exists
if [ -f tailwind.config.ts ]; then
    echo "✅ tailwind.config.ts exists"
else
    echo "❌ tailwind.config.ts missing"
    exit 1
fi

# Check tailwind.config.ts contains 'accent' (our custom color)
if grep -q 'accent' tailwind.config.ts; then
    echo "✅ tailwind.config.ts contains accent color mapping"
else
    echo "❌ tailwind.config.ts missing accent color mapping"
    exit 1
fi

# Check components.json exists
if [ -f components.json ]; then
    echo "✅ components.json exists"
else
    echo "❌ components.json missing"
    exit 1
fi

# Check shadcn components exist
components=(button input card textarea toggle-group)
for comp in "${components[@]}"; do
    if [ -f "src/components/ui/$comp.tsx" ]; then
        echo "✅ $comp component exists"
    else
        echo "⚠️  $comp component missing (may be added later)"
    fi
done

echo "✅ All checks passed!"