export function ComingSoon({ title }: { title: string }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-4 text-muted-foreground">Próximamente.</p>
    </section>
  );
}
