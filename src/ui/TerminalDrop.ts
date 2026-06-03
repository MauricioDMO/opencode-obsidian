interface TerminalDropContext {
  dragManager?: any;
  dataTransfer?: DataTransfer | null;
  ptyWrite?: (text: string) => void;
  onFileDrop?: (path: string) => void;
}

export function handleTerminalDrop(context: TerminalDropContext): void {
  const filesToProcess: string[] = [];

  if (context.dragManager?.draggable?.type === "file") {
    if (context.dragManager.draggable.file?.path) {
      filesToProcess.push(context.dragManager.draggable.file.path);
    }
  } else if (context.dragManager?.draggable?.type === "files") {
    if (Array.isArray(context.dragManager.draggable.files)) {
      context.dragManager.draggable.files.forEach((file: { path?: string }) => {
        if (file?.path) {
          filesToProcess.push(file.path);
        }
      });
    }
  } else if (context.dataTransfer?.files?.length) {
    for (let i = 0; i < context.dataTransfer.files.length; i++) {
      const file = context.dataTransfer.files[i] as File & { path?: string };
      if (file?.path) {
        filesToProcess.push(file.path);
      }
    }
  }

  if (filesToProcess.length === 0) {
    return;
  }

  if (context.onFileDrop) {
    const sendNext = (index: number) => {
      if (index >= filesToProcess.length) {
        return;
      }
      context.onFileDrop?.(filesToProcess[index]);
      if (index < filesToProcess.length - 1) {
        setTimeout(() => sendNext(index + 1), 75);
      }
    };
    sendNext(0);
    return;
  }

  if (!context.ptyWrite) {
    return;
  }

  const processNext = (index: number) => {
    if (index >= filesToProcess.length) {
      return;
    }

    context.ptyWrite?.(`@${filesToProcess[index]}`);
    setTimeout(() => {
      if (index < filesToProcess.length - 1) {
        context.ptyWrite?.(" ");
      }
      setTimeout(() => processNext(index + 1), 50);
    }, 100);
  };
  processNext(0);
}
