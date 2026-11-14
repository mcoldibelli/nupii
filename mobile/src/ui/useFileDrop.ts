import { useEffect, type RefObject } from "react";
import { Platform } from "react-native";

/**
 * On the web, a file dropped on the element of ref goes to onFile (the
 * AddPet-Web artboard: "Arraste uma imagem"). The app has no drag and drop:
 * it does nothing there.
 */
export function useFileDrop(ref: RefObject<unknown>, onFile: (file: File) => void): void {
  useEffect(() => {
    // On the web the ref of a View is its DOM element.
    const element = ref.current as unknown as HTMLElement | null;
    if (Platform.OS !== "web" || element === null) {
      return;
    }
    const over = (event: DragEvent) => event.preventDefault();
    const drop = (event: DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer?.files[0];
      if (file?.type.startsWith("image/")) {
        onFile(file);
      }
    };
    element.addEventListener("dragover", over);
    element.addEventListener("drop", drop);
    return () => {
      element.removeEventListener("dragover", over);
      element.removeEventListener("drop", drop);
    };
  }, [ref, onFile]);
}
