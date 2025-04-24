
export interface FileNode {
    name: string;
    path: string;
    is_dir: boolean;
    children: FileNode[];
    size: number;
    last_modified: number | null;
} 