declare namespace SuperTemplates {
	function compile(filename: string, options?: CompileOptions): Promise<string>;
	function create(compiledTemplate: string, helpers?: Helpers): TemplateFunction;
	function escape(str: string): string;

	interface CompileOptions {
		syncOnly?: boolean;
		resolve?: ResolveFunction;
		load?: LoadFunction;
	}

	type Helpers = Record<string | number | symbol, any>;
	type ResolveFunction = (includeString: string, resolveFrom: string) => string | Promise<string>;
	type LoadFunction = (filename: string) => string | Promise<string>;
	type TemplateFunction = SyncTemplateFunction | AsyncTemplateFunction;
	type SyncTemplateFunction = () => string;
	type AsyncTemplateFunction = () => AsyncIterableIterator<string>;
}

export = SuperTemplates;
