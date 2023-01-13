set -e

while read p; do
  dir=$(dirname $p)
  echo "$dir"
  (cd $dir && npm update)
done < package-locks.txt