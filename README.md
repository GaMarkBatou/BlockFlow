# BlockFlow Extension v0.26

## Futtatás indítófeltételekkel

A normál **Futtatás** most már tiszteletben tartja a Figyelő trigger feltételeit.

Ha egy automatizmusban nincs külön **Indítás** blokk, csak **Figyelő trigger**, akkor kézi Futtatáskor először a figyelőfeltételek kerülnek kiértékelésre. A műveleti blokkok csak akkor futnak, ha legalább egy aktív Figyelő trigger igaz eredményt ad.

Ha a figyelőfeltétel hamis, a workflow nem fut le, és a naplóban megjelenik, melyik trigger milyen eredményt adott.

## Kényszerített futtatás

A Builder felső sávjába és a Sidebarba bekerült a **Kényszerített futtatás / Force** opció.

Ez debug/tesztelési célra átugorja az indítófeltételeket, és közvetlenül a műveleti blokkokat futtatja. Így továbbra is tesztelhető például az Email megnyitása vagy Másik automatizmus futtatása blokk anélkül, hogy a figyelőfeltétel igaz lenne.

## Automatikus figyelők

A háttérben futó figyelők működése változatlan: automatikus indításnál a feltételek már előzetesen igazak voltak, ezért a workflow nem ellenőrzi őket újra futás közben.

## Alworkflow-k

A **Másik automatizmus futtatása** blokk subroutine-ként kezeli a meghívott automatizmust, ezért a meghívott workflow saját triggerfeltételei nem akadályozzák meg a hívást. A triggerfeltételek csak a közvetlen kézi Futtatás gombnál számítanak.
