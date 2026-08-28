const PUBLIC_CAST_PHOTO_MARKER = "/storage/v1/object/public/cast-photos/";

export function castPostImagePaths(
  imageUrls: string[] | null | undefined,
  supabaseUrl: string,
  storeId: string,
  castId: string,
) {
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(supabaseUrl).origin;
  } catch {
    return [];
  }

  const allowedPrefixes = [
    `admin-posts/${storeId}/${castId}/`,
    `posts/${castId}/`,
  ];
  const paths = new Set<string>();

  for (const imageUrl of imageUrls || []) {
    try {
      const parsed = new URL(imageUrl);
      if (parsed.origin !== expectedOrigin) continue;
      if (!parsed.pathname.startsWith(PUBLIC_CAST_PHOTO_MARKER)) continue;

      const encodedPath = parsed.pathname.slice(PUBLIC_CAST_PHOTO_MARKER.length);
      const path = decodeURIComponent(encodedPath);
      const segments = path.split("/");
      if (segments.some((segment) => !segment || segment === "." || segment === "..")) continue;
      if (!allowedPrefixes.some((prefix) => path.startsWith(prefix))) continue;
      paths.add(path);
    } catch {
      // 外部URLや壊れたURLは削除対象に含めない。
    }
  }

  return [...paths];
}
