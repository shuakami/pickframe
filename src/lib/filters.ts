import type { FilterQuery, Version } from "./types";
 
export function filterVersions(
 versions: Version[],
 filter: FilterQuery,
 searchText?: string,
): Version[] {
 return versions.filter((v) => {
 if (filter.projectId && v.projectId !== filter.projectId) return false;
 if (filter.pageIds?.length && !filter.pageIds.includes(v.pageId))
 return false;
 if (filter.verdicts?.length && !filter.verdicts.includes(v.verdict))
 return false;
 if (filter.tagIds?.length) {
 const has = filter.tagIds.some((t) => v.tagIds.includes(t));
 if (!has) return false;
    }
 if (filter.unrated && v.rating !== 0) return false;
 if (filter.minRating != null && v.rating < filter.minRating) return false;
 if (filter.hasAnnotations) {
 const n =
        v.annotations.strokes.length +
        v.annotations.shapes.length +
        v.annotations.notes.length;
 if (n === 0) return false;
    }
 if (searchText && searchText.trim()) {
 const q = searchText.trim().toLowerCase();
 if (
 !v.label.toLowerCase().includes(q) &&
 !v.note.toLowerCase().includes(q)
      ) {
 return false;
      }
    }
 return true;
  });
}
