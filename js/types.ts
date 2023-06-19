export type Person = {
  name: string;
  email: string;
};

export type OldLicense = {
  type: string;
  url: string;
};

export type ModuleInfo = {
  version: string;
  name: string;
  author?: Person;
  maintainers?: Person[];
  repository?: {
    type: 'git';
    url: string;
  };
  bugs?: {
    url: string;
  };
  description?: string;
  homepage?: string;
  keywords?: string[];
  unpublished?: boolean;
  license?: string;
  licenses?: OldLicense[];
  contributors?: Person[];

  // Only for versionless-repository requests
  versions?: ModuleInfo[];
};

export type GraphModuleInfo = {
  module: ModuleInfo;
  level: number;
  dependencies?: object[];
};

export type GraphState = {
  // Map of module key -> module info
  modules: Map<string, GraphModuleInfo>;

  // Upstream dependency types for each module
  referenceTypes: Map<string, Set<string>>;
};

export type npmsioResponse = {
  score: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
};
