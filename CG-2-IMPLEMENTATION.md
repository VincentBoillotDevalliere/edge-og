# CG-2 Implementation: Theme and Font Parameters with Fallbacks

## User Story
**CG-2**: En tant que dev je paramètre couleur, police  
**Criteria**: Champs `theme`, `font` avec valeurs de repli  
**Priority**: Must

## Implementation Summary

This implementation adds support for customizable themes and fonts for Open Graph image generation, with proper fallback values as specified in the roadmap.

### New Parameters

#### Theme Parameter (`theme`)
Supports 5 color themes with fallback to `light`:
- `light` (default) - White background, dark text, blue accent
- `dark` - Dark background, white text, blue accent  
- `blue` - Light blue background, dark blue text, blue accent
- `green` - Light green background, dark green text, green accent
- `purple` - Light purple background, dark purple text, purple accent

#### Font Parameter (`font`) 
Supports 4 font families with fallback to `inter`:
- `inter` (default) - Inter sans-serif font
- `roboto` - Roboto sans-serif font
- `playfair` - Playfair Display serif font
- `opensans` - Open Sans sans-serif font

### API Usage Examples

```bash
# Default (light theme, inter font)
GET /og?title=Hello&description=World

# Custom theme
GET /og?title=Hello&description=World&theme=purple

# Custom font  
GET /og?title=Hello&description=World&font=playfair

# Combined theme and font
GET /og?title=Hello&description=World&theme=green&font=roboto
```

### Validation & Error Handling

- Invalid theme values return 400 error with message: "Invalid theme parameter. Must be one of: light, dark, blue, green, purple"
- Invalid font values return 400 error with message: "Invalid font parameter. Must be one of: inter, roboto, playfair, opensans"
- Font loading failures automatically fallback to Inter font
- All fonts are loaded from Google Fonts with proper character subset support

### Technical Implementation

1. **Parameter Validation** (`src/index.ts`):
   - Extended `validateOGParams()` to handle new theme and font parameters
   - Added proper TypeScript types for all valid values
   - Maintains security requirement of 200 character limit validation

2. **Font Loading** (`src/render/svg.ts`):
   - New `getFontsByName()` function with automatic fallback to Inter
   - Dynamic Google Fonts loading with proper character subset
   - Font weight support (400, 700) for all font families
   - Error handling with graceful degradation

3. **Theme System** (`src/templates/default.ts`):
   - `getThemeColors()` function providing color schemes for all themes
   - `getFontFamily()` function mapping font names to CSS families
   - Updated template to use theme colors and font families dynamically

4. **Logging & Observability**:
   - Added `font` parameter to structured logs
   - Maintains existing performance monitoring
   - All requests logged with theme and font choices

### Performance & Caching

- Maintains TTFB ≤ 150ms requirement
- Font loading is cached at Google Fonts level
- Generated images still cached for 1 year with proper Cache-Control headers
- Font fallback mechanism prevents rendering failures

### Testing

Manual testing performed with development server:
- ✅ All 5 themes generate valid images
- ✅ All 4 fonts generate valid images  
- ✅ Combined theme+font parameters work correctly
- ✅ Invalid parameters return proper 400 errors
- ✅ Default fallbacks work when no parameters provided
- ✅ Font loading failures gracefully fallback to Inter

### Compliance

- ✅ **Security**: Parameter validation, character limits enforced
- ✅ **Performance**: TTFB maintained, CPU budget respected  
- ✅ **Caching**: 1-year cache headers preserved
- ✅ **Error Handling**: Meaningful error messages returned
- ✅ **Observability**: Structured logging with new parameters
- ✅ **Fallbacks**: Robust fallback system for themes and fonts

## Next Steps

CG-2 is now complete and ready for production deployment. The implementation provides:
- Developer-friendly API with intuitive parameter names
- Robust error handling and validation
- Performance-optimized font loading with fallbacks
- Comprehensive theme system with accessible color combinations
- Full backward compatibility with existing CG-1 functionality
