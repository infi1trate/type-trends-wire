/** The cache key for library-derived reads: the newest capture time and the newest AI tag time. Pure, for tests. */
export const crawlKey = (lastSnapshotAt: string | null, lastTagAt: string | null) => `${lastSnapshotAt ?? "-"}|${lastTagAt ?? "-"}`;
