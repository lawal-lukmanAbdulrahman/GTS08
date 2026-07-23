export const metadata = { title: "Order Detail" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main>
      <h1>Order Detail</h1>
      <p>Order ID: {id}</p>
    </main>
  );
}
