function isSafeSvg(svgContent) {
  if (typeof svgContent !== 'string') return false;

  const content = svgContent.replace(/^\uFEFF/, '');
  const lower = content.toLowerCase();

  if (!lower.includes('<svg')) return false;
  if (lower.includes('<script')) return false;
  if (lower.includes('<foreignobject')) return false;
  if (/\bjavascript\s*:/.test(lower)) return false;
  if (/(?:^|[\s<])on[a-z]+\s*=/.test(lower)) return false;

  return true;
}

module.exports = { isSafeSvg };
