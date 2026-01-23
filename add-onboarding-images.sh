#!/bin/bash

# Script to help add onboarding images
# Place your screenshot images in this directory and run this script

ONBOARDING_DIR="public/images/onboarding"

echo "Onboarding Images Setup"
echo "======================"
echo ""
echo "Please add your screenshot images to: $ONBOARDING_DIR"
echo ""
echo "Required files:"
echo "  1. login.png - Login screen screenshot"
echo "  2. upload.png - Upload interface screenshot"
echo "  3. form-fields.png - Form fields screenshot"
echo "  4. pdf-editor.png - PDF editor screenshot"
echo "  5. field-highlight.png - Field highlight screenshot"
echo ""
echo "After adding the images, they will automatically appear in the onboarding slideshow."
echo ""

# Check if images exist
if [ -f "$ONBOARDING_DIR/login.png" ] && \
   [ -f "$ONBOARDING_DIR/upload.png" ] && \
   [ -f "$ONBOARDING_DIR/form-fields.png" ] && \
   [ -f "$ONBOARDING_DIR/pdf-editor.png" ] && \
   [ -f "$ONBOARDING_DIR/field-highlight.png" ]; then
    echo "✓ All onboarding images found!"
    ls -lh "$ONBOARDING_DIR"/*.png
else
    echo "Missing images:"
    [ ! -f "$ONBOARDING_DIR/login.png" ] && echo "  ✗ login.png"
    [ ! -f "$ONBOARDING_DIR/upload.png" ] && echo "  ✗ upload.png"
    [ ! -f "$ONBOARDING_DIR/form-fields.png" ] && echo "  ✗ form-fields.png"
    [ ! -f "$ONBOARDING_DIR/pdf-editor.png" ] && echo "  ✗ pdf-editor.png"
    [ ! -f "$ONBOARDING_DIR/field-highlight.png" ] && echo "  ✗ field-highlight.png"
fi
