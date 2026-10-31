// Dots and Boxes N x N solver. Value = future box differential for player to move.
// mode 0: extra turn after completing a box. mode 1: one turn each.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define N 3
#define NH ((N+1)*N)      // horizontal lines h[r][c] r=0..N c=0..N-1
#define NV (N*(N+1))      // vertical lines  v[r][c] r=0..N-1 c=0..N
#define L (NH+NV)         // 24
static signed char *memo; static unsigned char *seen;
static int boxmask[N][N]; // 4 lines of each box
static int H(int r,int c){return r*N+c;} static int V(int r,int c){return NH+r*(N+1)+c;}
static int mode;
static int completed(unsigned m, int line){ int k=0; for(int i=0;i<N;i++)for(int j=0;j<N;j++) if((boxmask[i][j]>>line&1) && (m&boxmask[i][j])==(unsigned)boxmask[i][j]) k++; return k;}
static int solve(unsigned m){
  if(m==(1u<<L)-1) return 0;
  if(seen[m]) return memo[m];
  int best=-100;
  for(int l=0;l<L;l++){ if(m>>l&1) continue; unsigned m2=m|(1u<<l); int c=completed(m2,l);
    int v = (mode==0 && c>0) ? c+solve(m2) : c-solve(m2);
    if(v>best) best=v; }
  seen[m]=1; memo[m]=best; return best;
}
int main(int argc,char**argv){ mode=atoi(argv[1]);
  for(int i=0;i<N;i++)for(int j=0;j<N;j++) boxmask[i][j]=(1<<H(i,j))|(1<<H(i+1,j))|(1<<V(i,j))|(1<<V(i,j+1));
  memo=malloc(1u<<L); seen=calloc(1u<<L,1);
  int d=solve(0); int total=N*N;
  printf("mode %s: first player differential %d -> %d to %d\n", mode?"one-turn-each":"extra-turn", d,(total+d)/2,(total-d)/2);
  // best first moves
  printf("first moves with best value:");
  for(int l=0;l<L;l++){ unsigned m2=1u<<l; int c=0; int v=-solve(m2); if(v==d) printf(" %s%d", l<NH?"h":"v", l<NH?l:l-NH);} printf("\n");
  return 0; }
