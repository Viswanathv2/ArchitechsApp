import { useCallback, useEffect, useRef } from "react";

const MIN_COLUMN_WIDTH = 64;

function setupTable(table) {
  const headers = Array.from(table.querySelectorAll("thead th"));
  if (!headers.length) return () => {};

  const colgroup = document.createElement("colgroup");
  const columns = headers.map((header) => {
    const column = document.createElement("col");
    column.style.width = `${Math.max(MIN_COLUMN_WIDTH, header.getBoundingClientRect().width)}px`;
    colgroup.appendChild(column);
    return column;
  });
  table.insertBefore(colgroup, table.firstChild);

  const handles = [];
  headers.forEach((header, index) => {
    if (index === headers.length - 1) return;
    const handle = document.createElement("span");
    handle.className = "table-column-resizer";
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-label", `Resize ${header.textContent.trim()} column`);
    header.appendChild(handle);
    handles.push(handle);

    function startResize(event) {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startLeft = columns[index].getBoundingClientRect().width;
      const startRight = columns[index + 1].getBoundingClientRect().width;
      table.classList.add("is-resizing");

      function moveResize(moveEvent) {
        const total = startLeft + startRight;
        const delta = moveEvent.clientX - startX;
        const nextLeft = Math.min(total - MIN_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, startLeft + delta));
        columns[index].style.width = `${nextLeft}px`;
        columns[index + 1].style.width = `${total - nextLeft}px`;
      }

      function stopResize() {
        table.classList.remove("is-resizing");
        document.removeEventListener("pointermove", moveResize);
        document.removeEventListener("pointerup", stopResize);
      }

      document.addEventListener("pointermove", moveResize);
      document.addEventListener("pointerup", stopResize, { once: true });
    }

    handle.addEventListener("pointerdown", startResize);
  });

  return () => {
    handles.forEach((handle) => handle.remove());
    colgroup.remove();
  };
}

export function useResizableTable() {
  const cleanupByTable = useRef(new Map());

  const tableRef = useCallback((table) => {
    if (!table) return;
    cleanupByTable.current.set(table, setupTable(table));
  }, []);

  useEffect(() => () => {
    cleanupByTable.current.forEach((cleanup) => cleanup());
    cleanupByTable.current.clear();
  }, []);

  return tableRef;
}
