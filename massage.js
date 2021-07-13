const db = require('./lib/db');

go();

async function go() {
  const { plants, close } = await db();
  const values = await plants.find().toArray();
  for (const plant of values) {
    const months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];
    let [ from, to ] = plant['Flowering Months'].split('–');
    from = months.indexOf(from);
    to = months.indexOf(to);
    console.log(from, to);
    if ((from > -1) && (to > -1)) {
      console.log('hello');
      const matching = [];
      for (let i = from; (i <= to); i++) {
        matching.push(i);
      }
      console.log('>>', matching);
      await plants.updateOne({
        _id: plant._id
      }, {
        $set: {
          'Flowering Months By Number': matching
        }
      });
    } else {
      await plants.updateOne({
        _id: plant._id
      }, {
        $unset: {
          'Flowering Months By Number': 1
        }
      });
    }
  }
  await close();
}
