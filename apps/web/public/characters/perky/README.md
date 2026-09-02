# Perky character assets

The eight WebP files in this folder are web-optimized copies of the original
1254×1254 transparent PNG artwork. Use them through `PerkyCharacter` rather
than importing individual paths throughout the app.

```tsx
<PerkyCharacter state="search" size={160} />
```

Available states: `basic`, `search`, `found`, `guide`, `success`, `empty`,
`thinking`, and `wave`.
