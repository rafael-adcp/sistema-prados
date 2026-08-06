export function Carregando({ mensagem }: { mensagem: string }) {
  return (
    <div className="carregando" role="status">
      <span className="girador" aria-hidden="true" />
      {mensagem}
    </div>
  );
}
