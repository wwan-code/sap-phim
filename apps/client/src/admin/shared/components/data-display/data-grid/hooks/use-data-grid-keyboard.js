/**
 * @file use-data-grid-keyboard.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Hooks/UseDataGridKeyboard
 * @description Hook quản lý điều hướng bàn phím chuẩn ARIA Grid (Arrow keys, Home, End, Space, Enter).
 */

import { useState, useCallback, useRef } from 'react';

export const useDataGridKeyboard = ({
  rowCount = 0,
  colCount = 0,
  onSelectRow,
  pageRows = [],
}) => {
  const [focusedCell, setFocusedCell] = useState(null); // { rowIndex: number, colIndex: number }
  const gridContainerRef = useRef(null);

  const handleKeyDown = useCallback(
    (event) => {
      if (!focusedCell || rowCount === 0 || colCount === 0) return;

      const { rowIndex, colIndex } = focusedCell;

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          if (rowIndex < rowCount - 1) {
            setFocusedCell({ rowIndex: rowIndex + 1, colIndex });
          }
          break;
        }

        case 'ArrowUp': {
          event.preventDefault();
          if (rowIndex > 0) {
            setFocusedCell({ rowIndex: rowIndex - 1, colIndex });
          }
          break;
        }

        case 'ArrowRight': {
          event.preventDefault();
          if (colIndex < colCount - 1) {
            setFocusedCell({ rowIndex, colIndex: colIndex + 1 });
          }
          break;
        }

        case 'ArrowLeft': {
          event.preventDefault();
          if (colIndex > 0) {
            setFocusedCell({ rowIndex, colIndex: colIndex - 1 });
          }
          break;
        }

        case 'Home': {
          event.preventDefault();
          if (event.ctrlKey) {
            setFocusedCell({ rowIndex: 0, colIndex: 0 });
          } else {
            setFocusedCell({ rowIndex, colIndex: 0 });
          }
          break;
        }

        case 'End': {
          event.preventDefault();
          if (event.ctrlKey) {
            setFocusedCell({ rowIndex: rowCount - 1, colIndex: colCount - 1 });
          } else {
            setFocusedCell({ rowIndex, colIndex: colCount - 1 });
          }
          break;
        }

        case ' ': { // Space bar
          if (pageRows[rowIndex] && onSelectRow) {
            event.preventDefault();
            onSelectRow(pageRows[rowIndex], event);
          }
          break;
        }

        default:
          break;
      }
    },
    [focusedCell, rowCount, colCount, pageRows, onSelectRow]
  );

  return {
    focusedCell,
    setFocusedCell,
    gridContainerRef,
    handleKeyDown,
  };
};
