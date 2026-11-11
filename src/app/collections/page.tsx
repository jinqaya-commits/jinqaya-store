import { permanentRedirect } from "next/navigation";

// /shop is the canonical collection directory. Keep older collection links working.
export default function CollectionsIndexPage(): never {
  permanentRedirect("/shop");
}
