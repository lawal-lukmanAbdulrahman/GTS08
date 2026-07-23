export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <main>
      <h1>Search Results{q ? `: ${q}` : ''}</h1>
    </main>
  );
}
