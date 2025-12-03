import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_DEPTH = 4;
const DEFAULT_PATH = '/export/genealogy.json';

type OverrideState = 'expand' | 'collapse';

type NormalizedPerson = {
  id: number;
  generation?: number | null;
  gender?: string | null;
  name: string;
  birthDate: string;
  birthPlace: string;
  spouse: string;
  unionDate: string;
  unionPlace: string;
  childrenCount: string;
  deathDate: string;
  deathPlace: string;
  deathAge: string;
  job: string;
  children: NormalizedPerson[];
};

type Overrides = Record<number, OverrideState>;

const fieldMap = {
  name: ['Personne', 'name'],
  birthDate: ['Date de naissance', 'birth_date', 'birthDate'],
  birthPlace: ['Lieu de naissance', 'birth_place', 'birthPlace'],
  spouse: ['Conjoints', 'spouse'],
  unionDate: ["Date de l'union", 'union_date', 'unionDate'],
  unionPlace: ["Lieu de l'union", 'union_place', 'unionPlace'],
  childrenCount: ['Nb. enfants', 'children_count', 'childrenCount'],
  deathDate: ['Date de décès', 'death_date', 'deathDate'],
  deathPlace: ['Lieu de décès', 'death_place', 'deathPlace'],
  deathAge: ['Âge au décès', 'age_at_death', 'deathAge'],
  job: ['Profession', 'professions', 'job'],
};

const parseId = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const readField = (raw: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const candidate = raw[key];
    if (candidate !== undefined && candidate !== null) {
      return String(candidate);
    }
  }
  return '';
};

const normalizePerson = (raw: Record<string, unknown>): NormalizedPerson | null => {
  const id =
    parseId(raw?.id) ??
    parseId((raw as never)?.ID) ??
    parseId((raw as never)?.Id) ??
    parseId((raw as never)?.sosa) ??
    parseId((raw as never)?.Sosa);

  if (id === null) return null;

  const generation = parseId(raw?.generation) ?? null;
  const gender = (raw?.gender as string) ?? null;

  return {
    id,
    generation,
    gender,
    name: readField(raw, fieldMap.name),
    birthDate: readField(raw, fieldMap.birthDate),
    birthPlace: readField(raw, fieldMap.birthPlace),
    spouse: readField(raw, fieldMap.spouse),
    unionDate: readField(raw, fieldMap.unionDate),
    unionPlace: readField(raw, fieldMap.unionPlace),
    childrenCount: readField(raw, fieldMap.childrenCount),
    deathDate: readField(raw, fieldMap.deathDate),
    deathPlace: readField(raw, fieldMap.deathPlace),
    deathAge: readField(raw, fieldMap.deathAge),
    job: readField(raw, fieldMap.job),
    children: [],
  };
};

const normalizeDataset = (data: unknown): NormalizedPerson[] => {
  if (!data) return [];

  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.people)
      ? (data as Record<string, unknown>).people
      : Array.isArray((data as Record<string, unknown>)?.records)
        ? (data as Record<string, unknown>).records
        : [data];

  return list
    .map((item) => normalizePerson(item as Record<string, unknown>))
    .filter(Boolean) as NormalizedPerson[];
};

const buildMap = (people: NormalizedPerson[]) => {
  const map = new Map<number, NormalizedPerson>();
  people.forEach((person) => {
    map.set(person.id, { ...person, children: [] });
  });
  return map;
};

const buildTree = (
  rootId: number,
  peopleMap: Map<number, NormalizedPerson>,
  generation = 1,
): NormalizedPerson | null => {
  const node = peopleMap.get(rootId);
  if (!node) return null;

  const leftId = rootId * 2;
  const rightId = rootId * 2 + 1;

  const left = peopleMap.has(leftId) ? buildTree(leftId, peopleMap, generation + 1) : null;
  const right = peopleMap.has(rightId) ? buildTree(rightId, peopleMap, generation + 1) : null;

  return {
    ...node,
    generation: node.generation ?? generation,
    children: [left, right].filter(Boolean) as NormalizedPerson[],
  };
};

const findRootId = (peopleMap: Map<number, NormalizedPerson>) => {
  if (!peopleMap || peopleMap.size === 0) return null;
  if (peopleMap.has(1)) return 1;
  return Math.min(...Array.from(peopleMap.keys()));
};

const InfoRow = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm leading-tight text-black/80">
      <span className="engraved text-[11px] tracking-[0.2em] text-black/60">{label}</span>
      <span className="flex-1 border-b border-dashed border-black/20" />
      <span className="text-right">{value}</span>
    </div>
  );
};

type CardProps = {
  node: NormalizedPerson;
  incomingDepth: number;
  overrides: Overrides;
  setOverrides: Dispatch<SetStateAction<Overrides>>;
};

const PersonCard = ({ node, incomingDepth, overrides, setOverrides }: CardProps) => {
  const hasChildren = node.children && node.children.length > 0;
  const override = overrides[node.id];

  const effectiveDepth =
    override === 'collapse'
      ? 1
      : override === 'expand'
        ? DEFAULT_DEPTH
        : Math.max(incomingDepth, 1);

  const showChildren = hasChildren && effectiveDepth > 1;
  const childDepth = Math.max(effectiveDepth - 1, 0);

  const isOpen = showChildren;

  const toggle = () => {
    setOverrides((prev) => ({
      ...prev,
      [node.id]: isOpen ? 'collapse' : 'expand',
    }));
  };

  const badge = node.generation ? `Génération ${node.generation}` : undefined;

  return (
    <div className="flex flex-col items-center text-ink">
      <article
        onClick={toggle}
        className="w-[320px] sm:w-[360px] cursor-pointer bg-white/80 border border-black/25 shadow-card px-5 py-4 rounded-lg transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(0,0,0,0.18)] relative overflow-hidden"
      >
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-gradient-to-br from-white via-transparent to-black/[0.03]" />
        <div className="flex items-center justify-between mb-2 relative">
          <div className="engraved text-xs tracking-[0.3em] text-black/60">{badge}</div>
          {hasChildren && (
            <span className="flex items-center gap-2 text-xs text-black/70">
              <span className="engraved tracking-[0.2em]">{isOpen ? 'Déplié' : 'Plié'}</span>
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full border border-black/30 bg-white/70 shadow-sm text-lg leading-none"
                aria-label={isOpen ? 'Replier' : 'Déplier'}
              >
                {isOpen ? '−' : '+'}
              </span>
            </span>
          )}
        </div>

        <div className="relative">
          <h2 className="font-display text-2xl sm:text-[26px] leading-tight text-ink">
            {node.name || `Personne #${node.id}`}
          </h2>
          <p className="text-black/70 text-sm italic">
            {node.job || 'Profession non renseignée'}
          </p>
        </div>

        <div className="mt-3 space-y-1 relative">
          <InfoRow
            label="Naissance"
            value={[node.birthDate, node.birthPlace].filter(Boolean).join(' — ')}
          />
          <InfoRow
            label="Union"
            value={[
              node.spouse,
              [node.unionDate, node.unionPlace].filter(Boolean).join(' — '),
            ]
              .filter(Boolean)
              .join(' • ')}
          />
          <InfoRow
            label="Descendance"
            value={
              node.childrenCount ? `${node.childrenCount} enfant(s)` : 'Non précisé'
            }
          />
          <InfoRow
            label="Décès"
            value={[node.deathDate, node.deathPlace, node.deathAge].filter(Boolean).join(' — ')}
          />
        </div>

        <div className="mt-3 text-[11px] text-black/60 flex items-center justify-between engraved">
          <span>ID #{node.id}</span>
          {hasChildren ? (
            <span>
              {isOpen ? 'Ouvert sur 4 générations' : 'Cliquer pour ouvrir 4 générations'}
            </span>
          ) : (
            <span>Fin de branche</span>
          )}
        </div>
      </article>

      {showChildren && (
        <>
          <div className="h-8 border-l border-dashed border-black/30" />
          <div className="flex flex-row flex-nowrap gap-6 md:gap-10 justify-center overflow-x-auto pb-2">
            {node.children.map((child) => (
              <PersonCard
                key={child.id}
                node={child}
                incomingDepth={childDepth}
                overrides={overrides}
                setOverrides={setOverrides}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const Loader = () => (
  <div className="flex items-center gap-3 text-ink">
    <div className="h-8 w-8 border-2 border-black/70 border-t-transparent rounded-full animate-spin" />
    <span className="engraved text-xs tracking-[0.3em]">Chargement...</span>
  </div>
);

const ErrorBox = ({ message }: { message: string }) => (
  <div className="border border-red-900/60 bg-red-50/60 text-red-900 px-4 py-3 rounded-lg max-w-3xl">
    {message}
  </div>
);

const EmptyState = () => (
  <div className="max-w-2xl text-center text-black/70 space-y-2">
    <p className="text-lg">
      Placez un fichier JSON dans <code className="font-mono">export/genealogy.json</code> (racine
      du projet) ou mettez le même chemin dans le champ ci-dessous, puis chargez-le.
    </p>
    <p className="text-sm">
      Chaque personne doit avoir un <code className="font-mono">id</code>. Les parents sont{' '}
      <code className="font-mono">2k</code> et <code className="font-mono">2k+1</code>.
    </p>
  </div>
);

function App() {
  const [dataPath, setDataPath] = useState(DEFAULT_PATH);
  const [tree, setTree] = useState<NormalizedPerson | null>(null);
  const [peopleCount, setPeopleCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [overrides, setOverrides] = useState<Overrides>({});

  const loadFile = useCallback(
    async (path: string) => {
      setLoading(true);
      setError('');
      setTree(null);
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Impossible d'ouvrir ${path} (code ${response.status}).`);
        }
        const json = await response.json();
        const people = normalizeDataset(json);
        if (people.length === 0) {
          throw new Error('Aucune entrée valide trouvée dans ce fichier.');
        }

        const peopleMap = buildMap(people);
        const rootId = findRootId(peopleMap);
        if (!rootId) {
          throw new Error('Impossible de déterminer la racine (id le plus petit manquant).');
        }

        const treeBuilt = buildTree(rootId, peopleMap, 1);
        if (!treeBuilt) {
          throw new Error("L'arbre n'a pas pu être construit.");
        }

        setOverrides({ [rootId]: 'expand' });
        setPeopleCount(people.length);
        setTree(treeBuilt);
      } catch (err) {
        setError((err as Error).message ?? String(err));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadFile(DEFAULT_PATH);
  }, [loadFile]);

  return (
    <div className="max-w-7xl mx-auto px-4 pb-16">
      <header className="py-8 border-b border-black/20 mb-8">
        <p className="engraved text-xs tracking-[0.5em] text-black/70 mb-2">Ascendants</p>
        <h1 className="font-display text-4xl sm:text-5xl text-ink leading-none">
          Arbre généalogique
        </h1>
      </header>

      <main className="flex flex-col items-center gap-6">
        {loading && <Loader />}
        {error && <ErrorBox message={error} />}
        {!loading && !error && !tree && <EmptyState />}
        {!loading && !error && tree && (
          <div className="w-full overflow-auto pb-12">
            <div className="min-w-[320px] flex justify-center">
              <PersonCard
                node={tree}
                incomingDepth={DEFAULT_DEPTH}
                overrides={overrides}
                setOverrides={setOverrides}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
