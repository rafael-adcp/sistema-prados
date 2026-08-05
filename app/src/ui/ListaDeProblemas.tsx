export function ListaDeProblemas({ problemas }: { problemas: string[] }) {
  if (problemas.length === 0) return null;
  return (
    <ul className="lista-problemas">
      {problemas.map((problema) => (
        <li key={problema}>{problema}</li>
      ))}
    </ul>
  );
}
