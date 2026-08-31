// Shared brand mark — swap the image at /public/logoPro.png to rebrand everywhere at once.
export function Logo() {
  return (
    <>
      <img src="/logoPro.png" alt="Booking Pro" className="h-35 w-35 rounded-lg object-contain" />
      <span className="font-display text-2xl tracking-tight"></span>
    </>
  );
}
