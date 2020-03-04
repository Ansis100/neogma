import { QueryResult, Session } from 'neo4j-driver/types';
import { BindParam, WhereStatementI } from './Where';

export interface CreateRelationshipParamsI {
    a: {
        label: string;
    };
    b: {
        label: string;
    };
    relationship: {
        label: string;
        direction: 'out' | 'in' | 'none',
        /** values to be set as relationship attributes */
        values?: object;
    };
    /** can access query labels by `a` and `b` */
    where: WhereStatementI;
}

export class QueryRunner {

    /** whether to log the statements and parameters with the given function */
    private logger: (...val: Array<string | boolean | object | number>) => any;

    constructor(params?: {
        logger?: QueryRunner['logger'];
    }) {
        this.logger = params?.logger || null;
    }

    /** surrounds the label with backticks to also allow spaces */
    public static getLabel = (label: string) => '`' + label + '`';

    private log(...val: Array<string | boolean | object | number>) {
        this.logger?.(...val);
    }

    /**
     * 
     * @param session - the session for running this query
     * @param nodesLabel - the label of the nodes to create
     * @param options - the data to create
     */
    public createMany = async <T>(session: Session, nodesLabel: string, options: T[]): Promise<QueryResult> => {

        const label = QueryRunner.getLabel(nodesLabel);

        const statement = `
            UNWIND {options} as ${label}
            CREATE (node: ${label})
            SET node = ${label}
            RETURN ${label};
        `;

        const parameters = { options };

        this.log(statement, parameters);

        return session.run(statement, parameters);

    }

    /**
     * 
     * @param session - the session for running this query
     * @param nodesLabel - the label of the nodes to create
     * @param where - the where object for matching the nodes to be edited
     * @param options - the new data data, to be edited
     */
    public editMany = async <T>(session: Session, nodesLabel: string, options: Partial<T>, where?: WhereStatementI): Promise<QueryResult> => {
        const label = QueryRunner.getLabel(nodesLabel);

        let statement = `
            MATCH (${label}: ${label})
        `;
        if (where) {
            statement += `WHERE ${where.statement}`;
        }
        statement += `
            SET ${label} += { options }
            return ${label}
        `;

        const parameters = {
            ...BindParam.acquire(where?.bindParam).clone().add(options).get(),
        };

        this.log(statement, parameters);

        return session.run(statement, parameters);

    }

    /**
     * 
     * @param session - the session for running this query
     * @param nodesLabel - the label of the nodes to create
     * @param where - the where object for matching the nodes to be deleted
     */
    public deleteMany = async (session: Session, nodesLabel: string, where?: WhereStatementI): Promise<QueryResult> => {

        const label = QueryRunner.getLabel(nodesLabel);

        let statement = `
            MATCH (${label}: ${label})
        `;
        if (where) {
            statement += `WHERE ${where.statement}`;
        }
        statement += `
            OPTIONAL MATCH (${label})-[r]-()
            DELETE ${label},r
        `;

        const parameters = { ...where?.bindParam.get() };

        this.log(statement, parameters);

        return session.run(statement, parameters);

    }

    public createRelationship = async (session: Session, params: CreateRelationshipParamsI): Promise<QueryResult> => {

        const { a, b, relationship, where } = params;

        /** 
         * string in the format -[Label]->
         * relationship has the alias `r`
         */
        const directionString = `${relationship.direction === 'in' ? '<-' : '-'}[r:${QueryRunner.getLabel(relationship.label)}]${relationship.direction === 'out' ? '->' : '-'}`;

        /** the params of the relationship value */
        const relationshipAttributesParams = new BindParam(BindParam.acquire(where.bindParam).clone().get());
        /** the values to be converted to a string, to be put into the statement. They refer relationshipAttributesParams by their key name */
        const relationshipValues: string[] = [];
        if (relationship.values) {
            for (const key in relationship.values) {
                if (!relationship.values.hasOwnProperty(key)) { continue; }

                const paramName = relationshipAttributesParams.getUniqueNameAndAdd(key, relationship.values[key]);
                relationshipValues.push(`r.${key} = {${paramName}}`);
            }
        }

        /** the relationship values statement to be inserted into the final statement string */
        const relationshipValuesStatement = relationshipValues.length ? 'SET ' + relationshipValues.join(', ') : '';

        const statement = `
            MATCH (a:${QueryRunner.getLabel(a.label)}), (b:${QueryRunner.getLabel(b.label)})
            WHERE ${where.statement}
            CREATE (a)${directionString}(b)
            ${relationshipValuesStatement}
        `;

        const parameters = relationshipAttributesParams.get();

        this.log(statement, parameters);

        return session.run(statement, parameters);
    }

}
